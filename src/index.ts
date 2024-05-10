import {
    GraphQLString,
    Kind,
    type FieldNode,
    type GraphQLFieldConfig,
    type GraphQLSchema,
} from 'graphql';
import { GraphQLDateTime, GraphQLTimestamp } from 'graphql-scalars';
import moment, { type DurationInputArg2 } from 'moment';
import {
    applyRequestTransforms,
    applyResultTransforms,
    applySchemaTransforms,
} from '@graphql-mesh/utils';
import {
    type DelegationContext,
    type SubschemaConfig,
    type Transform,
} from '@graphql-tools/delegate';
import {
    addTypes,
    parseSelectionSet,
    type ExecutionRequest,
    type ExecutionResult,
} from '@graphql-tools/utils';
import { TransformCompositeFields } from '@graphql-tools/wrap';
import {
    DefaultCurrentFormat,
    DefaultNewFormat,
    type ToDateTimeTransformAlias,
    type ToDateTimeTransformConfig,
    type ToDateTimeWithScalarsTransformConfig,
} from './types';

export default class ToDatetimeTransform implements Transform {
    public noWrap: boolean = false;
    private readonly configs: ToDateTimeWithScalarsTransformConfig[];
    private readonly aliases: ToDateTimeTransformAlias[] = [];
    private readonly transformers: TransformCompositeFields[];

    constructor({ config }: { config: ToDateTimeTransformConfig[] }) {
        this.configs = this.withScalars(config);
        this.transformers = [
            new TransformCompositeFields(
                (
                    typeName: string,
                    fieldName: string,
                    fieldConfig: GraphQLFieldConfig<any, any>,
                ): GraphQLFieldConfig<any, any> =>
                    this.wrap(typeName, fieldName, fieldConfig) as GraphQLFieldConfig<any, any>,
                (typeName: string, fieldName: string, fieldNode: FieldNode): FieldNode =>
                    this.unwrap(typeName, fieldName, fieldNode),
                (value: any): any => this.serialize(value),
            ),
        ];
    }

    transformSchema(
        originalWrappingSchema: GraphQLSchema,
        subschemaConfig: SubschemaConfig,
        transformedSchema?: GraphQLSchema,
    ) {
        let newSchema = originalWrappingSchema;
        for (const config of this.configs) {
            if (!newSchema.getType(config.scalar.name)) {
                newSchema = addTypes(newSchema, [config.scalar]);
            }
        }

        return applySchemaTransforms(
            newSchema,
            subschemaConfig,
            transformedSchema,
            this.transformers,
        );
    }

    public transformRequest(
        originalRequest: ExecutionRequest,
        delegationContext: DelegationContext,
        transformationContext: any,
    ): ExecutionRequest {
        return applyRequestTransforms(
            originalRequest,
            delegationContext,
            transformationContext,
            this.transformers,
        );
    }

    transformResult(
        originalResult: ExecutionResult,
        delegationContext: DelegationContext,
        transformationContext: any,
    ) {
        return applyResultTransforms(
            originalResult,
            delegationContext,
            transformationContext,
            this.transformers,
        );
    }

    private wrap(
        typeName: string,
        fieldName: string,
        fieldConfig: GraphQLFieldConfig<any, any>,
    ): any {
        const config = this.getConfig(typeName, fieldName);

        return {
            ...fieldConfig,
            type: config ? config.scalar : fieldConfig.type,
        };
    }

    private unwrap(typeName: string, fieldName: string, fieldNode: FieldNode): any {
        const config = this.getConfig(typeName, fieldName);

        if (!config) {
            return fieldNode;
        }

        if (fieldNode.kind === Kind.FIELD) {
            if (!this.aliases.find(alias => alias.type === typeName && alias.name === fieldName)) {
                this.aliases.push({
                    type: typeName,
                    name: fieldName,
                    alias: fieldNode?.alias ? fieldNode.alias.value : fieldName,
                });
            }

            if (config.format.current == DefaultCurrentFormat.GoogleProtobufTimestamp) {
                return {
                    ...fieldNode,
                    selectionSet: parseSelectionSet(`{seconds, nanos}`),
                };
            }

            return fieldNode;
        }

        return fieldNode;
    }

    private serialize(value: any): any {
        if (!(typeof value === 'object') || !value?.__typename) {
            return value;
        }

        const types = this.configs.filter(config => config.typeName === value.__typename);

        if (types.length === 0) {
            return value;
        }

        for (const type of types) {
            for (const fieldName of type.fields) {
                let fieldNameOrAlias = fieldName;
                const alias = this.aliases.find(
                    aliasConfig =>
                        aliasConfig.type === value.__typename && aliasConfig.name === fieldName,
                );

                if (alias) {
                    fieldNameOrAlias = alias.alias;
                }

                if (value[fieldNameOrAlias]) {
                    value[fieldNameOrAlias] = this.toDateTime(value[fieldNameOrAlias], type);
                }
            }
        }

        return value;
    }

    private toDateTime(value: any, type: ToDateTimeWithScalarsTransformConfig) {
        if (!value) {
            return value;
        }

        let dateTimeMoment;

        if (
            type.format.current == DefaultCurrentFormat.GoogleProtobufTimestamp &&
            typeof value === 'object' &&
            value?.seconds
        ) {
            dateTimeMoment = moment(value.seconds * 1000 + (value.nanos || 0) / 1_000_000);
        } else if (isNaN(Number(value))) {
            dateTimeMoment = moment(value);
        } else {
            dateTimeMoment = moment.unix(Number(value));
        }

        if (type.modify?.includes(' ')) {
            let amount: string | number;
            let unit: string;
            [amount, unit] = type.modify.split(' ');

            amount = parseInt(amount);

            if (amount < 0) {
                dateTimeMoment = dateTimeMoment.subtract(
                    Math.abs(amount),
                    unit as DurationInputArg2,
                );
            } else {
                dateTimeMoment = dateTimeMoment.add(Math.abs(amount), unit as DurationInputArg2);
            }
        }

        switch (type.format.new) {
            case DefaultNewFormat.Utc: {
                return dateTimeMoment.format('YYYY-MM-DDTHH:mm:ss.SSS[Z]');
            }
            case DefaultNewFormat.Timestamp: {
                return dateTimeMoment.unix();
            }
            default: {
                return dateTimeMoment.format(type.format.new);
            }
        }
    }

    private getConfig(
        typeName: string,
        fieldName: string,
    ): ToDateTimeWithScalarsTransformConfig | undefined {
        return this.configs.find(
            config => config.typeName === typeName && config.fields.includes(fieldName),
        );
    }

    private withScalars(
        configs: ToDateTimeTransformConfig[],
    ): ToDateTimeWithScalarsTransformConfig[] {
        const newConfig: ToDateTimeWithScalarsTransformConfig[] = [];
        for (const config of configs) {
            let scalar;
            switch (config.format.new) {
                case DefaultNewFormat.Timestamp: {
                    scalar = GraphQLTimestamp;
                    break;
                }
                case DefaultNewFormat.Utc: {
                    scalar = GraphQLDateTime;
                    break;
                }
                default: {
                    scalar = GraphQLString;
                    break;
                }
            }

            newConfig.push({
                ...config,
                scalar,
            } as ToDateTimeWithScalarsTransformConfig);
        }

        return newConfig;
    }
}
