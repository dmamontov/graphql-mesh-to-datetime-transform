# To DateTime Transform for GraphQL Mesh

To Datetime Transform - is a transform for GraphQL Mesh that enables you to convert date formats within your GraphQL schema. This can be particularly useful for standardizing date representations, converting strings to datetime objects, or adjusting date formats to meet locale-specific requirements.

## Installation

Before you can use the to-datetime-transform, you need to install it along with GraphQL Mesh if you haven't already done so. You can install these using npm or yarn.

```bash
npm install @dmamontov/graphql-mesh-to-datetime-transform
```

or

```bash
yarn add @dmamontov/graphql-mesh-to-datetime-transform
```

## Configuration

### Modifying tsconfig.json

To make TypeScript recognize the To Datetime Transform, you need to add an alias in your tsconfig.json.

Add the following paths configuration under the compilerOptions in your tsconfig.json file:

```json
{
  "compilerOptions": {
    "paths": {
       "to-datetime": ["node_modules/@dmamontov/graphql-mesh-to-datetime-transform"]
    }
  }
}
```

### Adding the Transform to GraphQL Mesh

You need to include the Replace Config Transform in your GraphQL Mesh configuration file (usually .meshrc.yaml). Below is an example configuration that demonstrates how to use this transform:

```yaml
transforms:
  - toDatetime:
      typeName: Order
      fields: [created_at, updated_at]
      format:
        current: google.protobuf.timestamp
        new: utc
      modify: '-3 hours'
```

- **typeName**: The name of the entity type for which the date and time fields need to be converted.

- **fields**: A list of fields that need to be converted. These fields should be in date and time format.

- **format**: Defines the current and new formats of the date and time.
    - **current**: The current format of the field. Possible values:
        - utc: Time in UTC format.
        - timestamp: Time in Unix timestamp format.
        - google.protobuf.timestamp: Time in the format used by Google Protocol Buffers.
    - **new**: The desired format of the field after conversion. Possible values include:
        - utc: Time in UTC format.
        - timestamp: Time in Unix timestamp format.
        - A custom date string format, e.g., 'DD-MM-YYYY'.

- **modify**: Allows modification of the time (to add or subtract time).

## Conclusion

Remember, always test your configurations in a development environment before applying them in production to ensure that everything works as expected.