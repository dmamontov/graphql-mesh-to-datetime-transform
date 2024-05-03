import { type GraphQLScalarType } from 'graphql';

export interface ToDateTimeTransformConfig {
    typeName: string;
    fields: string[];
    format: ToDateTimeFormatTransformConfig;
    modify?: string;
}

export interface ToDateTimeFormatTransformConfig {
    current: string | DefaultCurrentFormat;
    new: string | DefaultNewFormat;
}

export enum DefaultCurrentFormat {
    Utc = 'utc',
    Timestamp = 'timestamp',
    GoogleProtobufTimestamp = 'google.protobuf.timestamp',
}

export enum DefaultNewFormat {
    Utc = 'utc',
    Timestamp = 'timestamp',
}

export type ToDateTimeWithScalarsTransformConfig = ToDateTimeTransformConfig & {
    scalar: GraphQLScalarType;
};

export const GoogleProtobufTimestampTypes = [
    'GoogleProtobufTimestamp',
    'google__protobuf__Timestamp',
];

export interface ToDateTimeTransformAlias {
    type: string;
    name: string;
    alias: string;
}
