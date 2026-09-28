import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { AllConfigType } from '../config/config.type';
import { RemotePdfRendererService } from './remote-pdf-renderer.service';

describe('RemotePdfRendererService', () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  const serviceWith = (values: Record<string, string | undefined>) =>
    new RemotePdfRendererService({
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService<AllConfigType>);

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: 'pdf-token' }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('should keep a path of the base url for render and download urls', async () => {
    const service = serviceWith({
      'app.pdfServiceBaseUrl': 'https://pdf.example.org/renderer',
      'app.pdfServiceAppKey': 'app-key',
    });

    const downloadUrl = await service.renderUrlToDownloadUrl(
      'https://backend/html',
      {},
    );

    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://pdf.example.org/renderer/render',
    );
    expect(downloadUrl).toBe('https://pdf.example.org/renderer/pdf/pdf-token');
  });

  it('should answer with 503 when the service is not configured', async () => {
    const service = serviceWith({});

    await expect(
      service.renderUrlToDownloadUrl('https://backend/html', {}),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should refuse to send the app key over plain HTTP to public hosts', async () => {
    const service = serviceWith({
      'app.pdfServiceBaseUrl': 'http://pdf.example.org',
      'app.pdfServiceAppKey': 'app-key',
    });

    await expect(
      service.renderUrlToDownloadUrl('https://backend/html', {}),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should allow plain HTTP to local hosts', async () => {
    const service = serviceWith({
      'app.pdfServiceBaseUrl': 'http://localhost:3001',
      'app.pdfServiceAppKey': 'app-key',
    });

    await expect(
      service.renderUrlToDownloadUrl('https://backend/html', {}),
    ).resolves.toBe('http://localhost:3001/pdf/pdf-token');
  });
});
