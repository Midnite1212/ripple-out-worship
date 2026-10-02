import { customAxios } from '../../components/custom/customAxios';
import { getNextSongCode } from './songCode';

jest.mock('../../components/custom/customAxios', () => ({ customAxios: { get: jest.fn() } }));

const mockGet = jest.mocked(customAxios.get);

type SongCodePage = { data?: { code?: string | null }[]; totalPages?: number };

const mockPages = (...pages: SongCodePage[]) => {
  pages.forEach((page) => mockGet.mockResolvedValueOnce({ data: page }));
};

const codes = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => ({ code: `${prefix}${from + i}` }));

beforeEach(() => {
  mockGet.mockReset();
});

describe('getNextSongCode', () => {
  it('returns <letter>1 when there are no results', async () => {
    mockPages({ data: [], totalPages: 0 });

    await expect(getNextSongCode('A')).resolves.toBe('A1');
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/api/songs/search', {
      params: { code: 'A', sortBy: 'code', limit: 100, page: 1 },
    });
  });

  it.each([{}, { data: undefined }, { data: null }])(
    'treats a response without a songs array (%p) as empty',
    async (page) => {
      mockGet.mockResolvedValueOnce({ data: page });
      await expect(getNextSongCode('B')).resolves.toBe('B1');
    }
  );

  it('treats an undefined response body as empty', async () => {
    mockGet.mockResolvedValueOnce({ data: undefined });
    await expect(getNextSongCode('B')).resolves.toBe('B1');
  });

  it('returns one more than the highest numeric suffix', async () => {
    mockPages({ data: [{ code: 'A2' }, { code: 'A10' }, { code: 'A9' }], totalPages: 1 });
    await expect(getNextSongCode('A')).resolves.toBe('A11');
  });

  it('matches codes case-insensitively and keeps the letter as passed', async () => {
    mockPages({ data: [{ code: 'a3' }, { code: 'A10' }, { code: 'A2' }], totalPages: 1 });
    await expect(getNextSongCode('A')).resolves.toBe('A11');

    mockPages({ data: [{ code: 'A5' }], totalPages: 1 });
    await expect(getNextSongCode('a')).resolves.toBe('a6');
  });

  it('ignores codes with a non-numeric suffix or another prefix', async () => {
    mockPages({
      data: [
        { code: 'A1' },
        { code: 'A2b' },
        { code: 'AB3' },
        { code: 'A 4' },
        { code: 'A-5' },
        { code: 'A' },
        { code: 'A1.5' },
        { code: 'B99' },
        { code: null },
        {},
      ],
      totalPages: 1,
    });
    await expect(getNextSongCode('A')).resolves.toBe('A2');
  });

  it('parses zero-padded suffixes as numbers', async () => {
    mockPages({ data: [{ code: 'A007' }], totalPages: 1 });
    await expect(getNextSongCode('A')).resolves.toBe('A8');
  });

  it('pages through more than 100 codes and keeps the highest across pages', async () => {
    mockPages(
      { data: codes('C', 1, 100), totalPages: 3 },
      { data: [{ code: 'C500' }, ...codes('C', 101, 199)], totalPages: 3 },
      { data: codes('C', 200, 204), totalPages: 3 }
    );

    await expect(getNextSongCode('C')).resolves.toBe('C501');
    expect(mockGet).toHaveBeenCalledTimes(3);
    expect(mockGet.mock.calls.map(([, config]) => config?.params.page)).toEqual([1, 2, 3]);
  });

  it('stops at totalPages even when the last page is full', async () => {
    mockPages({ data: codes('D', 1, 100), totalPages: 1 });

    await expect(getNextSongCode('D')).resolves.toBe('D101');
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('stops after one full page when totalPages is missing', async () => {
    mockPages({ data: codes('D', 1, 100) }, { data: [{ code: 'D900' }] });

    await expect(getNextSongCode('D')).resolves.toBe('D101');
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it('stops after 50 pages', async () => {
    mockGet.mockResolvedValue({ data: { data: codes('E', 1, 100), totalPages: 999 } });

    await expect(getNextSongCode('E')).resolves.toBe('E101');
    expect(mockGet).toHaveBeenCalledTimes(50);
  });

  it('matches every purely numeric code when the letter is empty', async () => {
    mockPages({ data: [{ code: '12' }, { code: 'A30' }], totalPages: 1 });
    await expect(getNextSongCode('')).resolves.toBe('13');
  });

  it('rejects when the request fails', async () => {
    mockGet.mockRejectedValueOnce(new Error('network'));
    await expect(getNextSongCode('A')).rejects.toThrow('network');
  });
});
