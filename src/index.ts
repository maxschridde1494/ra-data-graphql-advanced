import merge from 'lodash/merge';
import buildDataProvider, { BuildQueryFactory, Options, introspectSchema, IntrospectionOptions } from 'ra-data-graphql';
import { DataProvider, Identifier, GET_LIST, GET_ONE, GET_MANY, GET_MANY_REFERENCE, CREATE, UPDATE, DELETE, DELETE_MANY } from 'ra-core';
import pluralize from 'pluralize';

import buildQuery from './buildQuery';

const camelToSnake = (str: string) => {
    const pattern = /[A-Z]/g;
    const matches = str.match(pattern);

    if (matches.length === 0) return str;
    if (matches.length === 1 && matches[0] === str[0]) return str.toLowerCase();
    return str[0].toLowerCase() + str.slice(1).replace(pattern, (letter) => `_${letter.toLowerCase()}`)
}

export type FieldNamingConventions = 'camel' | 'snake';

// NOTE assumes str is in camel case to start
export const strWithNameConvention = (str: string, fieldNamingConvention: FieldNamingConventions = 'camel') => fieldNamingConvention === 'snake' ? camelToSnake(str) : str;

export const resourceNameWithNameConvention = (resource: string, fieldNamingConvention: FieldNamingConventions = 'camel') => fieldNamingConvention === 'snake' ? `_${camelToSnake(resource)}` : resource;

const buildIntrospection = (fieldNamingConvention: FieldNamingConventions = 'camel') => {
    const introspection = {
        operationNames: {
            [GET_LIST]: resource => `all${pluralize(resourceNameWithNameConvention(resource.name, fieldNamingConvention))}`,
            [GET_ONE]: resource => `${resource.name}`,
            [GET_MANY]: resource => `all${pluralize(resourceNameWithNameConvention(resource.name, fieldNamingConvention))}`,
            [GET_MANY_REFERENCE]: resource => `all${pluralize(resourceNameWithNameConvention(resource.name, fieldNamingConvention))}`,
            [CREATE]: resource => `create${resourceNameWithNameConvention(resource.name, fieldNamingConvention)}`,
            [UPDATE]: resource => `update${resourceNameWithNameConvention(resource.name, fieldNamingConvention)}`,
            [DELETE]: resource => `delete${resourceNameWithNameConvention(resource.name, fieldNamingConvention)}`,
            [DELETE_MANY]: resource =>`delete${pluralize(resourceNameWithNameConvention(resource.name, fieldNamingConvention))}`
        },
        exclude: undefined,
        include: undefined,
    }

    return introspection
}

export { buildQuery, introspectSchema, IntrospectionOptions, buildIntrospection }

export type DataProviderOptions = Omit<Options, 'buildQuery'> & { 
    buildQuery?: BuildQueryFactory; 
    dataProviderExtensions?: { [key: string]: any; }; // https://github.com/marmelab/react-admin/blob/master/packages/ra-core/src/types.ts#L136
    fieldNamingConvention?: FieldNamingConventions;
    resolveIntrospection?: typeof introspectSchema;
}

export default (
    options: DataProviderOptions
): Promise<DataProvider> => {
    const { dataProviderExtensions, fieldNamingConvention, ...customOptions } = options;
    return buildDataProvider(merge({}, { buildQuery, introspection: buildIntrospection(fieldNamingConvention) }, customOptions)).then(
        defaultDataProvider => {
            return {
                ...defaultDataProvider,
                // TODO support bulk updates
                // This provider does not support multiple updates so instead we send multiple UPDATE requests
                // This can be optimized using the apollo-link-batch-http link
                updateMany: (resource, params) => {
                    const { ids, data, ...otherParams } = params;
                    return Promise.all(
                        ids.map(id =>
                            defaultDataProvider.update(resource, {
                                id,
                                data: data,
                                previousData: null,
                                ...otherParams,
                            })
                        )
                    ).then(results => {
                        const data = results.reduce<Identifier[]>(
                            (acc, { data }) => [...acc, data.id],
                            []
                        );

                        return { data };
                    });
                },
                ...(dataProviderExtensions || {})
            };
        }
    );
};
