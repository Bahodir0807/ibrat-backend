import { serializeResource } from './resource.serializer';

describe('resource serializer', () => {
  it('maps _id to id without exposing raw _id or __v', () => {
    const response = serializeResource({
      _id: 'resource-1',
      name: 'Role',
      __v: 0,
    });

    expect(response).toEqual({
      id: 'resource-1',
      name: 'Role',
    });
    expect(response).not.toHaveProperty('_id');
    expect(response).not.toHaveProperty('__v');
  });
});
