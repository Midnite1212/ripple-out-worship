import { UIEvent, useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError, isCancel } from 'axios';
import { customAxios as axios } from '../../custom/customAxios';
import { SongSchema, SongSearchFilter } from '../../../types/song.types';
import { logRequestError } from '../../../helpers/global';

const useSetlistSongSearch = (onError: (message: string) => void) => {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [songResults, setSongResults] = useState<SongSchema[]>([]);
  const [filterData, setFilterData] = useState<SongSearchFilter>();
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  const getSongResults = useCallback(
    async (signal: AbortSignal) => {
      setLoading(true);
      try {
        //TODO: find a way so it only call once
        const payload = await axios.get('/api/songs/search', {
          params: {
            keyword: filterData?.search || '',
            themes: filterData?.themes || [],
            tempo: filterData?.tempo || [],
            page: page,
            limit: 20,
          },
          signal,
        });
        if (signal.aborted) return;
        setSongResults((prevSongs) => {
          const uniqueSongs = [...prevSongs, ...payload.data.data];
          const songMap = new Map();

          uniqueSongs.forEach((song) => {
            const id = song._id || song.id;
            songMap.set(id, song);
          });

          return Array.from(songMap.values());
        });
        setTotalPages(payload.data.totalPages);
      } catch (error) {
        if (isCancel(error) || signal.aborted) return;
        if (isAxiosError(error) && error.response?.status === 404) {
          setSongResults([]);
        } else {
          logRequestError('Error searching songs:', error);
          onError('Could not load songs. Please try again.');
        }
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    },
    [filterData, onError, page]
  );

  const handleScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      const searchDisplayBox = event.currentTarget;
      const { scrollTop, scrollHeight, clientHeight } = searchDisplayBox;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 5;
      if (isAtBottom && timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (!loading && isAtBottom && page < totalPages) {
        timeoutRef.current = setTimeout(() => {
          setPage((prevPage) => prevPage + 1);
        }, 300);
        searchDisplayBox.scrollTop = scrollTop - 30;
      }
    },
    [loading, page, totalPages]
  );

  useEffect(() => {
    const hasActiveFilter =
      !!filterData?.search?.trim() || (filterData?.themes?.length ?? 0) > 0 || !!filterData?.tempo;
    const controller = new AbortController();
    const timer = setTimeout(
      () => getSongResults(controller.signal),
      hasActiveFilter && page === 1 ? 1000 : 0
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [filterData, getSongResults, page]);

  const handleFilterChange = (value: SongSearchFilter) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setLoading(true);
    setFilterData(value);
    setSongResults([]);
    setPage(1);
  };

  return { filterData, songResults, loading, handleScroll, handleFilterChange };
};

export default useSetlistSongSearch;
