import {
    GET_LIST,
    GET_ONE,
    GET_MANY,
    GET_MANY_REFERENCE,
    CREATE,
    UPDATE,
    DELETE,
    DELETE_MANY,
    UPDATE_MANY
} from 'ra-core';

import { IntrospectedResource } from 'ra-data-graphql';

import pluralize from 'pluralize';

// currently only support 2 naming conventions (CAMEL is default)
export enum FieldNameConventionEnum {
    CAMEL = 'camel',
    SNAKE = 'snake',
}

const snakeToCamel = str => {
    const pattern = /([-_][a-z])/g;
    const matches = str.match(pattern);
    if (!matches || matches.length === 0) return str; // assume already camel for now

    return str
        .toLowerCase()
        .replace(/([-_][a-z])/g, group =>
            group.toUpperCase().replace('-', '').replace('_', '')
        );
};

const camelToSnake = (str: string) => {
    const pattern = /[A-Z]/g;
    const matches = str.match(pattern);

    if (!matches || matches.length === 0) return str; // assume already snake for now
    if (matches.length === 1 && matches[0] === str[0]) return str.toLowerCase();
    return (
        str[0].toLowerCase() +
        str.slice(1).replace(pattern, letter => `_${letter.toLowerCase()}`)
    );
};

type StrWithConventionFunc = (str: string) => string;
type ResourceAction =
    | typeof GET_LIST
    | typeof GET_ONE
    | typeof GET_MANY
    | typeof GET_MANY_REFERENCE
    | typeof CREATE
    | typeof UPDATE
    | typeof DELETE;

type FieldNameConventionsType = {
    [k in FieldNameConventionEnum]?: {
        listQueryToMeta: (listQuery: string) => string;
        resourceActionToField: {
            [k in ResourceAction]?: (resource: IntrospectedResource) => string;
        };
        resourceWithConvention: StrWithConventionFunc;
        strWithConvention: StrWithConventionFunc;
    };
};

// assume camel is the default name convention
// so will either stay camel or convert snake to camel
const strWithCamelConvention = (str: string) => snakeToCamel(str);

const camelActionToFieldMap = {
    [GET_LIST]: resource => `all${pluralize(resource.name)}`,
    [GET_ONE]: resource => resource.name,
    [GET_MANY]: resource => `all${pluralize(resource.name)}`,
    [GET_MANY_REFERENCE]: resource => `all${pluralize(resource.name)}`,
    [CREATE]: resource => `create${resource.name}`,
    [UPDATE]: resource => `update${resource.name}`,
    [UPDATE_MANY]: resource => `update${pluralize(resource.name)}`,
    [DELETE]: resource => `delete${resource.name}`,
    [DELETE_MANY]: resource => `delete${pluralize(resource.name)}`
};

const listQueryToMetaCamel = (listQuery: string) => `_${listQuery}Meta`;

// assume camel is the default name convention
// so will either convert camel to snake or stay snake
export const strWithSnakeConvention = (str: string) => camelToSnake(str);

const snakeActionToFieldMap = {
    [GET_LIST]: resource =>
        `all_${pluralize(strWithSnakeConvention(resource.name))}`,
    [GET_ONE]: resource => resource.name,
    [GET_MANY]: resource =>
        `all_${pluralize(strWithSnakeConvention(resource.name))}`,
    [GET_MANY_REFERENCE]: resource =>
        `all_${pluralize(strWithSnakeConvention(resource.name))}`,
    [CREATE]: resource => `create_${strWithSnakeConvention(resource.name)}`,
    [UPDATE]: resource => `update_${strWithSnakeConvention(resource.name)}`,
    [UPDATE_MANY]: resource => `update_${pluralize(strWithSnakeConvention(resource.name))}`,
    [DELETE]: resource => `delete_${strWithSnakeConvention(resource.name)}`,
    [DELETE_MANY]: resource => `delete_${pluralize(strWithSnakeConvention(resource.name))}`
};

const listQueryToMetaSnake = (listQuery: string) =>
    `_${listQuery}_${camelToSnake('Meta')}`;

export const FieldNameConventions: FieldNameConventionsType = {
    camel: {
        listQueryToMeta: listQueryToMetaCamel,
        resourceActionToField: camelActionToFieldMap,
        resourceWithConvention: strWithCamelConvention,
        strWithConvention: strWithCamelConvention,
    },
    snake: {
        listQueryToMeta: listQueryToMetaSnake,
        resourceActionToField: snakeActionToFieldMap,
        resourceWithConvention: strWithSnakeConvention,
        strWithConvention: strWithSnakeConvention,
    },
};
