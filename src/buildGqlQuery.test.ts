import { TypeKind, print } from 'graphql';
import {
    GET_LIST,
    GET_ONE,
    GET_MANY,
    GET_MANY_REFERENCE,
    UPDATE,
    CREATE,
    DELETE,
    DELETE_MANY,
    UPDATE_MANY,
} from 'ra-core';

import buildGqlQuery, {
    buildApolloArgs,
    buildArgs,
    buildFields,
} from './buildGqlQuery';
import { FieldNameConventionEnum } from './fieldNameConventions';

describe('buildArgs', () => {
    it('returns an empty array when query does not have any arguments', () => {
        expect(buildArgs({ args: [] }, {})).toEqual([]);
    });

    it('returns an array of args correctly filtered when query has arguments', () => {
        expect(
            print(
                buildArgs(
                    { args: [{ name: 'foo' }, { name: 'bar' }] },
                    { foo: 'foo_value' }
                )
            )
        ).toEqual(['foo: $foo']);
    });

    it('returns an array of args correctly filtered when query has camel arguments', () => {
        expect(
            print(
                buildArgs(
                    { args: [{ name: 'fooFull' }, { name: 'barFull' }] },
                    { fooFull: 'foo_value' },
                    FieldNameConventionEnum.CAMEL
                )
            )
        ).toEqual(['fooFull: $fooFull']);
    });

    it('returns an array of args correctly filtered when query has snake arguments and fieldNameConvention is snake', () => {
        expect(
            print(
                buildArgs(
                    { args: [{ name: 'foo_full' }, { name: 'bar_full' }] },
                    { foo_full: 'foo_value' },
                    FieldNameConventionEnum.SNAKE
                )
            )
        ).toEqual(['foo_full: $foo_full']);
    });
});

describe('buildApolloArgs', () => {
    it('returns an empty array when query does not have any arguments', () => {
        expect(print(buildApolloArgs({ args: [] }, {}))).toEqual([]);
    });

    it('returns an array of args correctly filtered when query has arguments', () => {
        expect(
            print(
                buildApolloArgs(
                    {
                        args: [
                            {
                                name: 'foo',
                                type: {
                                    kind: TypeKind.NON_NULL,
                                    ofType: {
                                        kind: TypeKind.SCALAR,
                                        name: 'Int',
                                    },
                                },
                            },
                            {
                                name: 'barId',
                                type: { kind: TypeKind.SCALAR, name: 'ID' },
                            },
                            {
                                name: 'barIds',
                                type: {
                                    kind: TypeKind.LIST,
                                    ofType: {
                                        kind: TypeKind.NON_NULL,
                                        ofType: {
                                            kind: TypeKind.SCALAR,
                                            name: 'ID',
                                        },
                                    },
                                },
                            },
                            { name: 'bar' },
                        ],
                    },
                    { foo: 'foo_value', barId: 100, barIds: [101, 102] }
                )
            )
        ).toEqual(['$foo: Int!', '$barId: ID', '$barIds: [ID!]']);
    });

    it('returns an array of args correctly filtered when query has snake arguments and FE fieldNameConvention is snake', () => {
        expect(
            print(
                buildApolloArgs(
                    {
                        args: [
                            {
                                name: 'foo',
                                type: {
                                    kind: TypeKind.NON_NULL,
                                    ofType: {
                                        kind: TypeKind.SCALAR,
                                        name: 'Int',
                                    },
                                },
                            },
                            {
                                name: 'bar_id',
                                type: { kind: TypeKind.SCALAR, name: 'ID' },
                            },
                            {
                                name: 'bar_ids',
                                type: {
                                    kind: TypeKind.LIST,
                                    ofType: {
                                        kind: TypeKind.NON_NULL,
                                        ofType: {
                                            kind: TypeKind.SCALAR,
                                            name: 'ID',
                                        },
                                    },
                                },
                            },
                            { name: 'bar' },
                        ],
                    },
                    { foo: 'foo_value', bar_id: 100, bar_ids: [101, 102] },
                    FieldNameConventionEnum.SNAKE
                )
            )
        ).toEqual(['$foo: Int!', '$bar_id: ID', '$bar_ids: [ID!]']);
    });

    it('returns an array of args correctly filtered when query has camel arguments and FE fieldNameConvention is camel', () => {
        expect(
            print(
                buildApolloArgs(
                    {
                        args: [
                            {
                                name: 'foo',
                                type: {
                                    kind: TypeKind.NON_NULL,
                                    ofType: {
                                        kind: TypeKind.SCALAR,
                                        name: 'Int',
                                    },
                                },
                            },
                            {
                                name: 'barId',
                                type: { kind: TypeKind.SCALAR, name: 'ID' },
                            },
                            {
                                name: 'barIds',
                                type: {
                                    kind: TypeKind.LIST,
                                    ofType: {
                                        kind: TypeKind.NON_NULL,
                                        ofType: {
                                            kind: TypeKind.SCALAR,
                                            name: 'ID',
                                        },
                                    },
                                },
                            },
                            { name: 'bar' },
                        ],
                    },
                    { foo: 'foo_value', barId: 100, barIds: [101, 102] },
                    FieldNameConventionEnum.CAMEL
                )
            )
        ).toEqual(['$foo: Int!', '$barId: ID', '$barIds: [ID!]']);
    });
});

function buildGQLParamsWithRequestedFieldsFactory() {
    const introspectionResults = {
        resources: [
            {
                type: {
                    name: 'resourceType',
                    fields: [
                        {
                            name: 'id',
                            type: { kind: TypeKind.SCALAR, name: 'ID' },
                        },
                        {
                            name: 'name',
                            type: { kind: TypeKind.SCALAR, name: 'String' },
                        },
                        {
                            name: 'foo',
                            type: { kind: TypeKind.SCALAR, name: 'String' },
                        },
                    ],
                },
            },
        ],
        types: [
            {
                name: 'linkedType',
                fields: [
                    {
                        name: 'id',
                        type: { kind: TypeKind.SCALAR, name: 'ID' },
                    },
                    {
                        name: 'title',
                        type: { kind: TypeKind.SCALAR, name: 'String' },
                    },
                    {
                        name: 'nestedLink',
                        type: {
                            kind: TypeKind.OBJECT,
                            name: 'nestedLinkedType',
                        },
                    },
                ],
            },
            {
                name: 'nestedLinkedType',
                fields: [
                    {
                        name: 'id',
                        type: { kind: TypeKind.SCALAR, name: 'ID' },
                    },
                    {
                        name: 'bar',
                        type: { kind: TypeKind.SCALAR, name: 'String' },
                    },
                ],
            },
        ],
    };

    const resource = {
        type: {
            fields: [
                { type: { kind: TypeKind.SCALAR, name: 'ID' }, name: 'id' },
                {
                    type: { kind: TypeKind.SCALAR, name: 'String' },
                    name: 'address',
                },
                {
                    type: { kind: TypeKind.SCALAR, name: 'String' },
                    name: 'foo',
                },
                {
                    type: { kind: TypeKind.SCALAR, name: '_internalField' },
                    name: 'foo1',
                },
                {
                    type: { kind: TypeKind.OBJECT, name: 'linkedType' },
                    name: 'linked',
                },
                {
                    type: { kind: TypeKind.OBJECT, name: 'resourceType' },
                    name: 'resource',
                },
            ],
        },
    };

    const queryType = {
        name: 'allCommand',
        args: [
            {
                name: 'foo',
                type: {
                    kind: TypeKind.NON_NULL,
                    ofType: { kind: TypeKind.SCALAR, name: 'Int' },
                },
            },
        ],
    };

    const params = {
        foo: 'foo_value',
        meta: {
            extraFields: [
                { linked: ['title'] },
                { resource: ['foo', 'name'] },
            ],
            sparseFields: [
                'address',
                { linked: ['title'] },
                { resource: ['foo', 'name'] },
            ],
        },
    };

    return { introspectionResults, queryType, params, resource };
}

describe('buildFields', () => {
    it('returns an object with the fields to retrieve', () => {
        const introspectionResults = {
            resources: [
                {
                    type: {
                        name: 'resourceType',
                        fields: [
                            {
                                name: 'id',
                                type: { kind: TypeKind.SCALAR, name: 'ID' },
                            },
                        ],
                    },
                },
            ],
            types: [
                {
                    name: 'linkedType',
                    fields: [
                        {
                            name: 'id',
                            type: { kind: TypeKind.SCALAR, name: 'ID' },
                        },
                    ],
                },
            ],
        };

        const fields = [
            { type: { kind: TypeKind.SCALAR, name: 'ID' }, name: 'id' },
            {
                type: { kind: TypeKind.SCALAR, name: '_internalField' },
                name: 'foo1',
            },
            {
                type: { kind: TypeKind.OBJECT, name: 'linkedType' },
                name: 'linked',
            },
            {
                type: { kind: TypeKind.OBJECT, name: 'resourceType' },
                name: 'resource',
            },
        ];

        expect(print(buildFields(introspectionResults)(fields))).toEqual([
            'id',
            `linked {
  id
}`,
            `resource {
  id
}`,
        ]);
    });
});

describe('buildFields with nested sparse fields', () => {
    const params = {
        foo: 'foo_value',
        meta: {
            sparseFields: [
                'address',
                { linked: ['title', { nestedLink: ['bar'] }] },
                { resource: ['foo', 'name'] },
            ],
        },
    };

    it('returns an object with the fields to retrieve', () => {
        const {
            introspectionResults,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        expect(
            print(
                buildFields(introspectionResults)(
                    resource.type.fields,
                    params.meta.sparseFields
                )
            )
        ).toEqual([
            'address',
            `linked {
  title
  nestedLink {
    bar
  }
}`,
            `resource {
  name
  foo
}`,
        ]);
    });
});

describe('buildFields with nested extra fields', () => {
    const params = {
        foo: 'foo_value',
        meta: {
            extraFields: [
                { linked: ['title', { nestedLink: ['bar'] }] },
                { resource: ['foo', 'name'] },
            ],
            sparseFields: ['id'],
        },
    };

    it('returns an object with the fields to retrieve', () => {
        const {
            introspectionResults,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        expect(
            print(
                buildFields(introspectionResults)(
                    resource.type.fields,
                    null,
                    params.meta.extraFields
                )
            )
        ).toEqual([
            'id',
            'address',
            'foo',
            `linked {
  title
  nestedLink {
    bar
  }
}`,
            `resource {
  name
  foo
}`,
        ]);
    });

    it('gives precedence to extra fields over sparse fields and returns an object with the fields to retrieve', () => {
        const {
            introspectionResults,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        expect(
            print(
                buildFields(introspectionResults)(
                    resource.type.fields,
                    params.meta.sparseFields,
                    params.meta.extraFields
                )
            )
        ).toEqual([
            'id',
            'address',
            'foo',
            `linked {
  title
  nestedLink {
    bar
  }
}`,
            `resource {
  name
  foo
}`,
        ]);
    });
});

describe('buildFieldsWithCircularDependency', () => {
    it('returns an object with the fields to retrieve', () => {
        const introspectionResults = {
            resources: [
                {
                    type: {
                        name: 'resourceType',
                        fields: [
                            {
                                name: 'id',
                                type: { kind: TypeKind.SCALAR, name: 'ID' },
                            },
                        ],
                    },
                },
            ],
            types: [
                {
                    name: 'linkedType',
                    fields: [
                        {
                            name: 'id',
                            type: { kind: TypeKind.SCALAR, name: 'ID' },
                        },
                        {
                            name: 'child',
                            type: { kind: TypeKind.OBJECT, name: 'linkedType' },
                        },
                    ],
                },
            ],
        };

        const fields = [
            { type: { kind: TypeKind.SCALAR, name: 'ID' }, name: 'id' },
            {
                type: { kind: TypeKind.SCALAR, name: '_internalField' },
                name: 'foo1',
            },
            {
                type: { kind: TypeKind.OBJECT, name: 'linkedType' },
                name: 'linked',
            },
            {
                type: { kind: TypeKind.OBJECT, name: 'resourceType' },
                name: 'resource',
            },
        ];

        expect(print(buildFields(introspectionResults)(fields))).toEqual([
            'id',
            `linked {
  id
}`,
            `resource {
  id
}`,
        ]);
    });
});

describe('buildFieldsWithSameType', () => {
    it('returns an object with the fields to retrieve', () => {
        const introspectionResults = {
            resources: [
                {
                    type: {
                        name: 'resourceType',
                        fields: [
                            {
                                name: 'id',
                                type: { kind: TypeKind.SCALAR, name: 'ID' },
                            },
                        ],
                    },
                },
            ],
            types: [
                {
                    name: 'linkedType',
                    fields: [
                        {
                            name: 'id',
                            type: { kind: TypeKind.SCALAR, name: 'ID' },
                        },
                    ],
                },
            ],
        };

        const fields = [
            { type: { kind: TypeKind.SCALAR, name: 'ID' }, name: 'id' },
            {
                type: { kind: TypeKind.SCALAR, name: '_internalField' },
                name: 'foo1',
            },
            {
                type: { kind: TypeKind.OBJECT, name: 'linkedType' },
                name: 'linked',
            },
            {
                type: { kind: TypeKind.OBJECT, name: 'linkedType' },
                name: 'anotherLinked',
            },
            {
                type: { kind: TypeKind.OBJECT, name: 'resourceType' },
                name: 'resource',
            },
        ];

        expect(print(buildFields(introspectionResults)(fields))).toEqual([
            'id',
            `linked {
  id
}`,
            `anotherLinked {
  id
}`,
            `resource {
  id
}`,
        ]);
    });
});

describe('buildGqlQuery', () => {
    const introspectionResults = {
        resources: [
            {
                type: {
                    name: 'resourceType',
                    fields: [
                        {
                            name: 'id',
                            type: { kind: TypeKind.SCALAR, name: 'ID' },
                        },
                    ],
                },
            },
        ],
        types: [
            {
                name: 'linkedType',
                fields: [
                    {
                        name: 'foo',
                        type: { kind: TypeKind.SCALAR, name: 'bar' },
                    },
                ],
            },
        ],
    };

    const introspectionResultsSnake = {
        resources: [{ type: { name: 'resourceType' } }],
        types: [
            {
                name: 'linkedType',
                fields: [
                    {
                        name: 'foo_full',
                        type: { kind: TypeKind.SCALAR, name: 'bar' },
                    },
                ],
            },
        ],
    };

    const resource = {
        type: {
            fields: [
                { type: { kind: TypeKind.SCALAR, name: '' }, name: 'foo' },
                { type: { kind: TypeKind.SCALAR, name: '_foo' }, name: 'foo1' },
                {
                    type: { kind: TypeKind.OBJECT, name: 'linkedType' },
                    name: 'linked',
                },
                {
                    type: { kind: TypeKind.OBJECT, name: 'resourceType' },
                    name: 'resource',
                },
            ],
        },
    };

    const resourceSnake = {
        type: {
            fields: [
                { type: { kind: TypeKind.SCALAR, name: '' }, name: 'foo_full' },
                {
                    type: { kind: TypeKind.SCALAR, name: '_foo' },
                    name: 'foo1_full',
                },
                {
                    type: { kind: TypeKind.OBJECT, name: 'linkedType' },
                    name: 'linked_full',
                },
                {
                    type: { kind: TypeKind.OBJECT, name: 'resourceType' },
                    name: 'resource_full',
                },
            ],
        },
    };

    const queryType = {
        name: 'allCommand',
        args: [
            {
                name: 'foo',
                type: {
                    kind: TypeKind.NON_NULL,
                    ofType: { kind: TypeKind.SCALAR, name: 'Int' },
                },
            },
            {
                name: 'barId',
                type: { kind: TypeKind.SCALAR },
            },
            {
                name: 'barIds',
                type: { kind: TypeKind.SCALAR },
            },
            { name: 'bar' },
        ],
    };

    const queryTypeDeleteMany = {
        name: 'deleteCommands',
        args: [
            {
                name: 'ids',
                type: {
                    kind: TypeKind.LIST,
                    ofType: {
                        kind: TypeKind.NON_NULL,
                        ofType: {
                            kind: TypeKind.SCALAR,
                            name: 'ID',
                        },
                    },
                },
            },
        ],
    };

    const queryTypeUpdateMany = {
        name: 'updateCommands',
        args: [
            {
                name: 'ids',
                type: {
                    kind: TypeKind.LIST,
                    ofType: {
                        kind: TypeKind.NON_NULL,
                        ofType: {
                            kind: TypeKind.SCALAR,
                            name: 'ID',
                        },
                    },
                },
            },
            {
                name: 'data',
                type: { kind: TypeKind.OBJECT, name: 'CommandType' },
            },
        ],
    };
    const queryTypeSnake = {
        name: 'all_command',
        args: [
            {
                name: 'foo_full',
                type: {
                    kind: TypeKind.NON_NULL,
                    ofType: { kind: TypeKind.SCALAR, name: 'Int' },
                },
            },
            {
                name: 'bar_id',
                type: { kind: TypeKind.SCALAR },
            },
            {
                name: 'bar_ids',
                type: { kind: TypeKind.SCALAR },
            },
            { name: 'bar' },
        ],
    };

    const params = { foo: 'foo_value' };

    const paramsCamel = { fooFull: 'foo_value' };
    const paramsSnake = { foo_full: 'foo_value' };

    it('returns the correct query for GET_LIST', () => {
        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    GET_LIST,
                    queryType,
                    params
                )
            )
        ).toEqual(
            `query allCommand($foo: Int!) {
  items: allCommand(foo: $foo) {
    foo
    linked {
      foo
    }
    resource {
      id
    }
  }
  total: _allCommandMeta(foo: $foo) {
    count
  }
}
`
        );
    });

    it('returns the correct query for GET_LIST with snake query args and snake FE fieldNameConvention', () => {
        expect(
            print(
                buildGqlQuery(
                    introspectionResults,
                    FieldNameConventionEnum.SNAKE
                )(resourceSnake, GET_LIST, queryTypeSnake, paramsSnake)
            )
        ).toEqual(
            `query all_command($foo_full: Int!) {
  items: all_command(foo_full: $foo_full) {
    foo_full
    linked_full {
      foo
    }
    resource_full {
      id
    }
  }
  total: _all_command_meta(foo_full: $foo_full) {
    count
  }
}
`
        );
    });
    it('returns the correct query for GET_MANY', () => {
        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    GET_MANY,
                    queryType,
                    params
                )
            )
        ).toEqual(
            `query allCommand($foo: Int!) {
  items: allCommand(foo: $foo) {
    foo
    linked {
      foo
    }
    resource {
      id
    }
  }
  total: _allCommandMeta(foo: $foo) {
    count
  }
}
`
        );
    });
    it('returns the correct query for GET_MANY_REFERENCE', () => {
        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    GET_MANY_REFERENCE,
                    queryType,
                    params
                )
            )
        ).toEqual(
            `query allCommand($foo: Int!) {
  items: allCommand(foo: $foo) {
    foo
    linked {
      foo
    }
    resource {
      id
    }
  }
  total: _allCommandMeta(foo: $foo) {
    count
  }
}
`
        );
    });
    it('returns the correct query for GET_ONE', () => {
        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    GET_ONE,
                    { ...queryType, name: 'getCommand' },
                    params
                )
            )
        ).toEqual(
            `query getCommand($foo: Int!) {
  data: getCommand(foo: $foo) {
    foo
    linked {
      foo
    }
    resource {
      id
    }
  }
}
`
        );
    });
    it('returns the correct query for UPDATE', () => {
        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    UPDATE,
                    { ...queryType, name: 'updateCommand' },
                    params
                )
            )
        ).toEqual(
            `mutation updateCommand($foo: Int!) {
  data: updateCommand(foo: $foo) {
    foo
    linked {
      foo
    }
    resource {
      id
    }
  }
}
`
        );
    });
    it('returns the correct query for CREATE', () => {
        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    CREATE,
                    { ...queryType, name: 'createCommand' },
                    params
                )
            )
        ).toEqual(
            `mutation createCommand($foo: Int!) {
  data: createCommand(foo: $foo) {
    foo
    linked {
      foo
    }
    resource {
      id
    }
  }
}
`
        );
    });
    it('returns the correct query for DELETE', () => {
        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    DELETE,
                    { ...queryType, name: 'deleteCommand' },
                    params
                )
            )
        ).toEqual(
            `mutation deleteCommand($foo: Int!) {
  data: deleteCommand(foo: $foo) {
    foo
    linked {
      foo
    }
    resource {
      id
    }
  }
}
`
        );
    });

    it('returns the correct query for DELETE_MANY', () => {
        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    DELETE_MANY,
                    queryTypeDeleteMany,
                    { ids: [1, 2, 3] }
                )
            )
        ).toEqual(
            `mutation deleteCommands($ids: [ID!]) {
  data: deleteCommands(ids: $ids) {
    ids
  }
}
`
        );
    });

    it('returns the correct query for UPDATE_MANY', () => {
        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    UPDATE_MANY,
                    queryTypeUpdateMany,
                    {
                        ids: [1, 2, 3],
                        data: params,
                    }
                )
            )
        ).toEqual(
            `mutation updateCommands($ids: [ID!], $data: CommandType) {
  data: updateCommands(ids: $ids, data: $data) {
    ids
  }
}
`
        );
    });
});

describe('buildGqlQuery with sparse fields', () => {
    it('returns the correct query for GET_LIST', () => {
        const {
            introspectionResults,
            params,
            queryType,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        const sparseFieldParams = {...params}
        delete sparseFieldParams.meta.extraFields

        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    GET_LIST,
                    queryType,
                    sparseFieldParams
                )
            )
        ).toEqual(
            `query allCommand($foo: Int!) {
  items: allCommand(foo: $foo) {
    address
    linked {
      title
    }
    resource {
      name
      foo
    }
  }
  total: _allCommandMeta(foo: $foo) {
    count
  }
}
`
        );
    });
    it('returns the correct query for GET_MANY', () => {
        const {
            introspectionResults,
            params,
            queryType,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        const sparseFieldParams = {...params}
        delete sparseFieldParams.meta.extraFields

        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    GET_MANY,
                    queryType,
                    sparseFieldParams
                )
            )
        ).toEqual(
            `query allCommand($foo: Int!) {
  items: allCommand(foo: $foo) {
    address
    linked {
      title
    }
    resource {
      name
      foo
    }
  }
  total: _allCommandMeta(foo: $foo) {
    count
  }
}
`
        );
    });
    it('returns the correct query for GET_MANY_REFERENCE', () => {
        const {
            introspectionResults,
            params,
            queryType,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        const sparseFieldParams = {...params}
        delete sparseFieldParams.meta.extraFields

        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    GET_MANY_REFERENCE,
                    queryType,
                    sparseFieldParams
                )
            )
        ).toEqual(
            `query allCommand($foo: Int!) {
  items: allCommand(foo: $foo) {
    address
    linked {
      title
    }
    resource {
      name
      foo
    }
  }
  total: _allCommandMeta(foo: $foo) {
    count
  }
}
`
        );
    });
    it('returns the correct query for GET_ONE', () => {
        const {
            introspectionResults,
            params,
            queryType,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        const sparseFieldParams = {...params}
        delete sparseFieldParams.meta.extraFields

        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    GET_ONE,
                    { ...queryType, name: 'getCommand' },
                    sparseFieldParams
                )
            )
        ).toEqual(
            `query getCommand($foo: Int!) {
  data: getCommand(foo: $foo) {
    address
    linked {
      title
    }
    resource {
      name
      foo
    }
  }
}
`
        );
    });
    it('returns the correct query for UPDATE', () => {
        const {
            introspectionResults,
            params,
            queryType,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        const sparseFieldParams = {...params}
        delete sparseFieldParams.meta.extraFields

        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    UPDATE,
                    { ...queryType, name: 'updateCommand' },
                    sparseFieldParams
                )
            )
        ).toEqual(
            `mutation updateCommand($foo: Int!) {
  data: updateCommand(foo: $foo) {
    address
    linked {
      title
    }
    resource {
      name
      foo
    }
  }
}
`
        );
    });
    it('returns the correct query for CREATE', () => {
        const {
            introspectionResults,
            params,
            queryType,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        const sparseFieldParams = {...params}
        delete sparseFieldParams.meta.extraFields

        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    CREATE,
                    { ...queryType, name: 'createCommand' },
                    sparseFieldParams
                )
            )
        ).toEqual(
            `mutation createCommand($foo: Int!) {
  data: createCommand(foo: $foo) {
    address
    linked {
      title
    }
    resource {
      name
      foo
    }
  }
}
`
        );
    });
    it('returns the correct query for DELETE', () => {
        const {
            introspectionResults,
            params,
            queryType,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();
        
        const sparseFieldParams = {...params}
        delete sparseFieldParams.meta.extraFields

        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    DELETE,
                    { ...queryType, name: 'deleteCommand' },
                    sparseFieldParams
                )
            )
        ).toEqual(
            `mutation deleteCommand($foo: Int!) {
  data: deleteCommand(foo: $foo) {
    address
    linked {
      title
    }
    resource {
      name
      foo
    }
  }
}
`
        );
    });
});

describe('buildGqlQuery with extra fields', () => {
    it('returns the correct query for GET_LIST', () => {
        const {
            introspectionResults,
            params,
            queryType,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    GET_LIST,
                    queryType,
                    params
                )
            )
        ).toEqual(
            `query allCommand($foo: Int!) {
  items: allCommand(foo: $foo) {
    id
    address
    foo
    linked {
      title
    }
    resource {
      name
      foo
    }
  }
  total: _allCommandMeta(foo: $foo) {
    count
  }
}
`
        );
    });
    it('returns the correct query for GET_MANY', () => {
        const {
            introspectionResults,
            params,
            queryType,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    GET_MANY,
                    queryType,
                    params
                )
            )
        ).toEqual(
            `query allCommand($foo: Int!) {
  items: allCommand(foo: $foo) {
    id
    address
    foo
    linked {
      title
    }
    resource {
      name
      foo
    }
  }
  total: _allCommandMeta(foo: $foo) {
    count
  }
}
`
        );
    });
    it('returns the correct query for GET_MANY_REFERENCE', () => {
        const {
            introspectionResults,
            params,
            queryType,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    GET_MANY_REFERENCE,
                    queryType,
                    params
                )
            )
        ).toEqual(
            `query allCommand($foo: Int!) {
  items: allCommand(foo: $foo) {
    id
    address
    foo
    linked {
      title
    }
    resource {
      name
      foo
    }
  }
  total: _allCommandMeta(foo: $foo) {
    count
  }
}
`
        );
    });
    it('returns the correct query for GET_ONE', () => {
        const {
            introspectionResults,
            params,
            queryType,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    GET_ONE,
                    { ...queryType, name: 'getCommand' },
                    params
                )
            )
        ).toEqual(
            `query getCommand($foo: Int!) {
  data: getCommand(foo: $foo) {
    id
    address
    foo
    linked {
      title
    }
    resource {
      name
      foo
    }
  }
}
`
        );
    });
    it('returns the correct query for UPDATE', () => {
        const {
            introspectionResults,
            params,
            queryType,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    UPDATE,
                    { ...queryType, name: 'updateCommand' },
                    params
                )
            )
        ).toEqual(
            `mutation updateCommand($foo: Int!) {
  data: updateCommand(foo: $foo) {
    id
    address
    foo
    linked {
      title
    }
    resource {
      name
      foo
    }
  }
}
`
        );
    });
    it('returns the correct query for CREATE', () => {
        const {
            introspectionResults,
            params,
            queryType,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    CREATE,
                    { ...queryType, name: 'createCommand' },
                    params
                )
            )
        ).toEqual(
            `mutation createCommand($foo: Int!) {
  data: createCommand(foo: $foo) {
    id
    address
    foo
    linked {
      title
    }
    resource {
      name
      foo
    }
  }
}
`
        );
    });
    it('returns the correct query for DELETE', () => {
        const {
            introspectionResults,
            params,
            queryType,
            resource,
        } = buildGQLParamsWithRequestedFieldsFactory();

        expect(
            print(
                buildGqlQuery(introspectionResults)(
                    resource,
                    DELETE,
                    { ...queryType, name: 'deleteCommand' },
                    params
                )
            )
        ).toEqual(
            `mutation deleteCommand($foo: Int!) {
  data: deleteCommand(foo: $foo) {
    id
    address
    foo
    linked {
      title
    }
    resource {
      name
      foo
    }
  }
}
`
        );
    });
});
