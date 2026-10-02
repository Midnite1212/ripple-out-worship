import { Dispatch, SetStateAction, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { displayResultOptions } from '../../constants';
import { SongSearchFilter } from '../../types/song.types';

const useSongFilters = (setFilterData: Dispatch<SetStateAction<SongSearchFilter | undefined>>) => {
  const location = useLocation();
  const [searchString, setSearchString] = useState('');
  const [tempoList, setTempoList] = useState<string[]>([]);
  const [themeList, setThemeList] = useState<string[]>([]);
  const [displayResultList, setDisplayResultList] = useState<string[]>(displayResultOptions);

  useEffect(() => {
    if (location.search) {
      setSearchString(new URLSearchParams(location.search).get('q') ?? '');
    }
  }, [location.search]);

  useEffect(() => {
    setFilterData({
      search: searchString,
      tempo: tempoList,
      themes: themeList,
      display: {
        tempo: displayResultList.includes('Tempo'),
        themes: displayResultList.includes('Themes'),
        firstLine: displayResultList.includes('First Line Lyric'),
        originalKey: displayResultList.includes('Original Key'),
        year: displayResultList.includes('Year'),
        code: displayResultList.includes('Code'),
        timeSignature: displayResultList.includes('Time'),
      },
    });
  }, [searchString, tempoList, themeList, displayResultList, setFilterData]);

  const resetFilters = () => {
    setSearchString('');
    setTempoList([]);
    setThemeList([]);
    setDisplayResultList(displayResultOptions);
  };

  return {
    displayResultList,
    resetFilters,
    searchString,
    setDisplayResultList,
    setSearchString,
    setTempoList,
    setThemeList,
    tempoList,
    themeList,
  };
};

export default useSongFilters;
