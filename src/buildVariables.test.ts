import { TypeKind } from 'graphql';
import {
    GET_LIST,
    GET_MANY,
    GET_MANY_REFERENCE,
    CREATE,
    UPDATE,
    DELETE,
    DELETE_MANY,
    UPDATE_MANY,
} from 'ra-core';
import buildVariables from './buildVariables';
import { FieldNameConventionEnum } from './fieldNameConventions';

describe('buildVariables', () => {
    const introspectionResult = {
        types: [
            {
                name: 'PostFilter',
                inputFields: [{ name: 'tags_some' }],
            },
        ],
    };

    const introspectionResultSnake = {
        types: [
            {
                name: 'PostFilter',
                inputFields: [{ name: 'post_status' }],
            },
        ],
    };

    describe('GET_LIST', () => {
        it('returns correct variables', () => {
            const params = {
                filter: {
                    ids: ['foo1', 'foo2'],
                    tags: { id: ['tag1', 'tag2'] },
                    'author.id': 'author1',
                    views: 100,
                },
                pagination: { page: 10, perPage: 10 },
                sort: { field: 'sortField', order: 'DESC' },
            };

            expect(
                buildVariables(introspectionResult)(
                    { type: { name: 'Post', fields: [] } },
                    GET_LIST,
                    params,
                    {}
                )
            ).toEqual({
                filter: {
                    ids: ['foo1', 'foo2'],
                    tags_some: { id_in: ['tag1', 'tag2'] },
                    author: { id: 'author1' },
                    views: 100,
                },
                page: 9,
                perPage: 10,
                sortField: 'sortField',
                sortOrder: 'DESC',
            });
        });

        it('returns correct variables for snake field name convention', () => {
            const params = {
                filter: {
                    ids: ['foo1', 'foo2'],
                    post_status: ['draft', 'published'],
                },
                pagination: { page: 10, perPage: 10 },
                sort: { field: 'sortField', order: 'DESC' },
            };

            expect(
                buildVariables(
                    introspectionResultSnake,
                    FieldNameConventionEnum.SNAKE
                )({ type: { name: 'Post', fields: [] } }, GET_LIST, params, {})
            ).toEqual({
                filter: {
                    ids: ['foo1', 'foo2'],
                    post_status: ['draft', 'published'],
                },
                page: 9,
                per_page: 10,
                sort_field: 'sortField',
                sort_order: 'DESC',
            });
        });
    });

    describe('CREATE', () => {
        it('returns correct variables', () => {
            const params = {
                data: {
                    author: { id: 'author1' },
                    tags: [{ id: 'tag1' }, { id: 'tag2' }],
                    title: 'Foo',
                },
            };
            const queryType = {
                args: [{ name: 'tagsIds' }, { name: 'authorId' }],
            };

            expect(
                buildVariables(introspectionResult)(
                    { type: { name: 'Post' } },
                    CREATE,
                    params,
                    queryType
                )
            ).toEqual({
                authorId: 'author1',
                tagsIds: ['tag1', 'tag2'],
                title: 'Foo',
            });
        });

        it('returns correct variables for snake fieldname conventions', () => {
            const params = {
                data: {
                    author: { id: 'author1' },
                    tags: [{ id: 'tag1' }, { id: 'tag2' }],
                    title: 'Foo',
                },
            };
            const queryType = {
                args: [{ name: 'tags_ids' }, { name: 'author_id' }],
            };

            expect(
                buildVariables(
                    introspectionResultSnake,
                    FieldNameConventionEnum.SNAKE
                )({ type: { name: 'Post' } }, CREATE, params, queryType)
            ).toEqual({
                author_id: 'author1',
                tags_ids: ['tag1', 'tag2'],
                title: 'Foo',
            });
        });
    });

    describe('UPDATE', () => {
        it('returns correct variables', () => {
            const params = {
                id: 'post1',
                data: {
                    author: { id: 'author1' },
                    tags: [{ id: 'tag1' }, { id: 'tag2' }],
                    title: 'Foo',
                },
            };
            const queryType = {
                args: [{ name: 'tagsIds' }, { name: 'authorId' }],
            };

            expect(
                buildVariables(introspectionResult)(
                    { type: { name: 'Post' } },
                    UPDATE,
                    params,
                    queryType
                )
            ).toEqual({
                id: 'post1',
                authorId: 'author1',
                tagsIds: ['tag1', 'tag2'],
                title: 'Foo',
            });
        });

        it('returns correct variables for snake fieldname conventions', () => {
            const params = {
                id: 'post1',
                data: {
                    author: { id: 'author1' },
                    tags: [{ id: 'tag1' }, { id: 'tag2' }],
                    title: 'Foo',
                },
            };
            const queryType = {
                args: [{ name: 'tags_ids' }, { name: 'author_id' }],
            };

            expect(
                buildVariables(
                    introspectionResultSnake,
                    FieldNameConventionEnum.SNAKE
                )({ type: { name: 'Post' } }, UPDATE, params, queryType)
            ).toEqual({
                id: 'post1',
                author_id: 'author1',
                tags_ids: ['tag1', 'tag2'],
                title: 'Foo',
            });
        });
    });

    describe('GET_MANY', () => {
        it('returns correct variables', () => {
            const params = {
                ids: ['tag1', 'tag2'],
            };

            expect(
                buildVariables(introspectionResult)(
                    { type: { name: 'Post' } },
                    GET_MANY,
                    params,
                    {}
                )
            ).toEqual({
                filter: { ids: ['tag1', 'tag2'] },
            });
        });
    });

    describe('GET_MANY_REFERENCE', () => {
        it('returns correct variables', () => {
            const params = {
                target: 'author_id',
                id: 'author1',
                pagination: { page: 1, perPage: 10 },
                sort: { field: 'name', order: 'ASC' },
            };

            expect(
                buildVariables(introspectionResult)(
                    { type: { name: 'Post' } },
                    GET_MANY_REFERENCE,
                    params,
                    {}
                )
            ).toEqual({
                filter: { author_id: 'author1' },
                page: 0,
                perPage: 10,
                sortField: 'name',
                sortOrder: 'ASC',
            });
        });

        it('returns correct variables for snake fieldname conventions', () => {
            const params = {
                target: 'author_id',
                id: 'author1',
                pagination: { page: 1, perPage: 10 },
                sort: { field: 'name', order: 'ASC' },
            };

            expect(
                buildVariables(
                    introspectionResultSnake,
                    FieldNameConventionEnum.SNAKE
                )({ type: { name: 'Post' } }, GET_MANY_REFERENCE, params, {})
            ).toEqual({
                filter: { author_id: 'author1' },
                page: 0,
                per_page: 10,
                sort_field: 'name',
                sort_order: 'ASC',
            });
        });
    });

    describe('DELETE', () => {
        it('returns correct variables', () => {
            const params = {
                id: 'post1',
            };
            expect(
                buildVariables(introspectionResult)(
                    { type: { name: 'Post', inputFields: [] } },
                    DELETE,
                    params,
                    {}
                )
            ).toEqual({
                id: 'post1',
            });
        });
    });

    describe('DELETE_MANY', () => {
        it('returns correct variables', () => {
            const params = {
                ids: ['post1'],
            };
            expect(
                buildVariables(introspectionResult)(
                    { type: { name: 'Post', inputFields: [] } },
                    DELETE_MANY,
                    params,
                    {}
                )
            ).toEqual({
                ids: ['post1'],
            });
        });
    });

    describe('UPDATE_MANY', () => {
        it('returns correct variables', () => {
            const params = {
                ids: ['post1', 'post2'],
                data: {
                    title: 'New Title',
                },
            };
            expect(
                buildVariables(introspectionResult)(
                    { type: { name: 'Post', inputFields: [] } },
                    UPDATE_MANY,
                    params,
                    {}
                )
            ).toEqual({
                ids: ['post1', 'post2'],
                data: {
                    title: 'New Title',
                },
            });
        });
    });
});

describe('buildVariables with meta param', () => {
    const introspectionResult = {
        types: [
            {
                name: 'PostFilter',
                inputFields: [{ name: 'tags_some' }],
            },
        ],
    };
    describe('GET_LIST', () => {
        it('returns correct variables', () => {
            const params = {
                filter: {
                    ids: ['foo1', 'foo2'],
                    tags: { id: ['tag1', 'tag2'] },
                    'author.id': 'author1',
                    views: 100,
                },
                pagination: { page: 10, perPage: 10 },
                sort: { field: 'sortField', order: 'DESC' },
                meta: { sparseFields: [] },
            };

            expect(
                buildVariables(introspectionResult)(
                    { type: { name: 'Post', fields: [] } },
                    GET_LIST,
                    params,
                    {}
                )
            ).toEqual({
                filter: {
                    ids: ['foo1', 'foo2'],
                    tags_some: { id_in: ['tag1', 'tag2'] },
                    author: { id: 'author1' },
                    views: 100,
                },
                page: 9,
                perPage: 10,
                sortField: 'sortField',
                sortOrder: 'DESC',
                meta: { sparseFields: [] },
            });
        });
    });

    describe('CREATE', () => {
        it('returns correct variables', () => {
            const params = {
                data: {
                    author: { id: 'author1' },
                    tags: [{ id: 'tag1' }, { id: 'tag2' }],
                    title: 'Foo',
                    meta: { sparseFields: [] },
                },
            };
            const queryType = {
                args: [{ name: 'tagsIds' }, { name: 'authorId' }],
            };

            expect(
                buildVariables(introspectionResult)(
                    { type: { name: 'Post' } },
                    CREATE,
                    params,
                    queryType
                )
            ).toEqual({
                authorId: 'author1',
                tagsIds: ['tag1', 'tag2'],
                title: 'Foo',
                meta: { sparseFields: [] },
            });
        });
    });

    describe('UPDATE', () => {
        it('returns correct variables', () => {
            const params = {
                id: 'post1',
                data: {
                    author: { id: 'author1' },
                    tags: [{ id: 'tag1' }, { id: 'tag2' }],
                    title: 'Foo',
                    meta: { sparseFields: [] },
                },
            };
            const queryType = {
                args: [{ name: 'tagsIds' }, { name: 'authorId' }],
            };

            expect(
                buildVariables(introspectionResult)(
                    { type: { name: 'Post' } },
                    UPDATE,
                    params,
                    queryType
                )
            ).toEqual({
                id: 'post1',
                authorId: 'author1',
                tagsIds: ['tag1', 'tag2'],
                title: 'Foo',
                meta: { sparseFields: [] },
            });
        });
    });

    describe('GET_MANY', () => {
        it('returns correct variables', () => {
            const params = {
                ids: ['tag1', 'tag2'],
                meta: { sparseFields: [] },
            };

            expect(
                buildVariables(introspectionResult)(
                    { type: { name: 'Post' } },
                    GET_MANY,
                    params,
                    {}
                )
            ).toEqual({
                filter: { ids: ['tag1', 'tag2'] },
                meta: { sparseFields: [] },
            });
        });
    });

    describe('GET_MANY_REFERENCE', () => {
        it('returns correct variables', () => {
            const params = {
                target: 'author_id',
                id: 'author1',
                pagination: { page: 1, perPage: 10 },
                sort: { field: 'name', order: 'ASC' },
                meta: { sparseFields: [] },
            };

            expect(
                buildVariables(introspectionResult)(
                    { type: { name: 'Post' } },
                    GET_MANY_REFERENCE,
                    params,
                    {}
                )
            ).toEqual({
                filter: { author_id: 'author1' },
                page: 0,
                perPage: 10,
                sortField: 'name',
                sortOrder: 'ASC',
                meta: { sparseFields: [] },
            });
        });
    });

    describe('DELETE', () => {
        it('returns correct variables', () => {
            const params = {
                id: 'post1',
                meta: { sparseFields: [] },
            };
            expect(
                buildVariables(introspectionResult)(
                    { type: { name: 'Post', inputFields: [] } },
                    DELETE,
                    params,
                    {}
                )
            ).toEqual({
                id: 'post1',
                meta: { sparseFields: [] },
            });
        });
    });
});
