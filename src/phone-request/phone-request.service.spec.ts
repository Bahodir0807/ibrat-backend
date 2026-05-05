import { PhoneRequestService } from './phone-request.service';

function chain<T>(result: T) {
  const query: Record<string, jest.Mock> = {
    exec: jest.fn(async () => result),
  };
  return query;
}

function createService(overrides: Record<string, jest.Mock> = {}) {
  const phoneRequestModel = Object.assign(
    jest.fn(),
    {
      findOne: jest.fn(),
      findById: jest.fn(),
      find: jest.fn(),
      countDocuments: jest.fn(),
      findByIdAndUpdate: jest.fn(),
    },
    overrides,
  );

  return {
    service: new PhoneRequestService(phoneRequestModel as any),
    phoneRequestModel,
  };
}

describe('PhoneRequestService public responses', () => {
  it('does not expose phone, telegramId, name, or raw _id in public status lookup', async () => {
    const { service, phoneRequestModel } = createService();
    phoneRequestModel.findOne.mockReturnValue(chain({
      _id: 'request-1',
      phone: '+100000000',
      name: 'Private Name',
      telegramId: '12345',
      status: 'pending',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    }));

    await expect(service.getPublicStatusByTelegramId('12345')).resolves.toEqual({
      id: 'request-1',
      status: 'pending',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    });
  });
});
