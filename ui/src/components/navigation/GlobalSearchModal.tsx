import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Box, Fade, InputAdornment, Modal, TextField, Typography, useTheme } from '@mui/material';

import SongSearchResult from './searchModalComponents/SongSearchResult';
import { useNavigate } from 'react-router-dom';
import SetlistSearchResult from './searchModalComponents/SetlistSearchResult';
import { SongSchema } from '../../types/song.types';
import { Setlist } from '../../types/setlist.types';
import SearchIcon from '@mui/icons-material/Search';
import RadioCard from './searchModalComponents/RadioCard';

type GlobalSearchModalProps = {
  isOpen: boolean;
  onClose: () => void;
  allSongs: SongSchema[];
  allSetlists: Setlist[];
};

const GlobalSearchModal = (props: GlobalSearchModalProps) => {
  const { isOpen, onClose, allSongs, allSetlists } = props;
  const theme = useTheme();

  const radioFilters = ['Songs', 'Setlists'];
  const [radioFilter, setRadioFilter] = useState('Songs');

  const [searchString, setSearchString] = useState('');
  const filterKeyword = useMemo(() => searchString.trim().toLowerCase(), [searchString]);

  useEffect(() => {
    if (!isOpen) setSearchString('');
  }, [isOpen]);

  const filteredSongs = useMemo(() => {
    if (filterKeyword.length < 2 || allSongs.length === 0) return [];
    return allSongs.filter((song) => song.title?.toLowerCase().includes(filterKeyword));
  }, [filterKeyword, allSongs]);

  const filteredSetlists = useMemo(() => {
    if (filterKeyword.length < 2 || allSetlists.length === 0) return [];
    return allSetlists.filter((setlist) => setlist.name?.toLowerCase().includes(filterKeyword));
  }, [filterKeyword, allSetlists]);

  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);

  useEffect(() => {
    setFocusedIndex(-1);
  }, [filterKeyword, radioFilter]);

  useEffect(() => {
    if (isOpen && inputRef.current && focusedIndex === -1) {
      inputRef.current.focus();
    }
  }, [isOpen, radioFilter, focusedIndex]);

  // Handle keyboard events
  const resultRefs = useRef<HTMLDivElement[]>([]);
  const handleKeyDown: React.KeyboardEventHandler<HTMLDivElement> = (e) => {
    const key = e.key;
    const results = radioFilter === 'Songs' ? filteredSongs : filteredSetlists;

    if (key === 'Escape') {
      setFocusedIndex(-1);
    } else if (key === 'Enter') {
      e.preventDefault();
      const focusedResult = focusedIndex !== -1 ? results[focusedIndex] : undefined;
      if (focusedResult) {
        navigate(
          radioFilter === 'Songs'
            ? `/song/${focusedResult._id}`
            : `/setlist/view/${focusedResult._id}`
        );
      } else if (e.target === inputRef.current) {
        navigate(
          radioFilter === 'Songs' ? `/song?q=${encodeURIComponent(searchString)}` : '/setlist'
        );
      } else {
        return;
      }
      onClose();
    } else if (!results.length) {
      return;
    } else if (key === 'ArrowDown') {
      setFocusedIndex((prevIndex) => (prevIndex + 1) % results.length);
    } else if (key === 'ArrowUp') {
      setFocusedIndex((prevIndex) => {
        if (prevIndex === 0) {
          return -1;
        } else {
          return (prevIndex - 1 + results.length) % results.length;
        }
      });
    }
  };

  // Scroll to focused element
  useEffect(() => {
    if (focusedIndex !== -1) {
      if (
        resultRefs &&
        resultRefs.current &&
        resultRefs.current[focusedIndex] !== null &&
        resultRefs.current[focusedIndex] !== undefined
      ) {
        resultRefs.current[focusedIndex].scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
        });
      }
    }
  }, [focusedIndex]);

  const renderResults = () => {
    if (radioFilter === 'Songs') {
      if (filterKeyword === '') {
        return (
          <SongSearchResult
            _id=""
            title=""
            keyword=""
            ref={(el) => (resultRefs.current[0] = el as HTMLDivElement)}
            isFocused={focusedIndex === 0}
            onClose={onClose}
          />
        );
      }

      if (filteredSongs && filteredSongs.length > 0) {
        return filteredSongs.map((song, index) => (
          <SongSearchResult
            key={song._id}
            _id={song._id}
            title={song.title}
            keyword={filterKeyword}
            ref={(el) => (resultRefs.current[index] = el as HTMLDivElement)}
            isFocused={index === focusedIndex}
            onClose={onClose}
          />
        ));
      }

      return (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'row',
            justifyContent: 'flex-start',
            alignItems: 'center',
            width: '100%',
            p: '0.75rem',
          }}
        >
          <Typography variant="body1" color="onSurface.variant">
            No songs found
          </Typography>
        </Box>
      );
    }

    if (filterKeyword === '') {
      return (
        <SetlistSearchResult
          _id=""
          name=""
          keyword={filterKeyword}
          ref={(el) => (resultRefs.current[0] = el as HTMLDivElement)}
          isFocused={focusedIndex === 0}
          onClose={onClose}
        />
      );
    }

    if (filteredSetlists && filteredSetlists.length > 0) {
      return filteredSetlists.map((setlist, index) => (
        <SetlistSearchResult
          key={setlist._id}
          _id={setlist._id}
          name={setlist.name}
          keyword={filterKeyword}
          ref={(el) => (resultRefs.current[index] = el as HTMLDivElement)}
          isFocused={index === focusedIndex}
          onClose={onClose}
        />
      ));
    }

    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'row',
          justifyContent: 'flex-start',
          alignItems: 'center',
          width: '100%',
          p: '0.75rem',
        }}
      >
        <Typography variant="body1" color="onSurface.variant">
          No setlists found
        </Typography>
      </Box>
    );
  };

  return (
    <Modal open={isOpen} onClose={onClose} closeAfterTransition>
      <Fade in={isOpen}>
        <Box
          sx={{
            position: 'fixed',
            top: ['0vh', '22.5vh'],
            left: ['0vw', '30vw'],
            backgroundColor: 'background.default',
            borderRadius: '10px',
            p: '1rem',
            width: ['100%', '40%'],
          }}
          onKeyDown={handleKeyDown}
        >
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              border: `1px solid ${theme.palette.primary.dark}`,
              borderRadius: '15px',
              backgroundColor: 'surface.container',
              padding: '1rem',
            }}
          >
            <Box
              sx={{
                display: 'flex',
                gap: '8px',
              }}
            >
              {radioFilters.map((value) => (
                <RadioCard
                  key={value}
                  isSelected={value === radioFilter}
                  onClick={() => setRadioFilter(value)}
                >
                  {value}
                </RadioCard>
              ))}
            </Box>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                width: '100%',
                backgroundColor: 'surface.container',
              }}
            >
              <TextField
                variant="standard"
                size="medium"
                placeholder="Search songs keywords"
                InputProps={{
                  style: {
                    fontFamily: 'DM Sans, sans-serif',
                    fontSize: '1rem',
                    color: theme.palette.onSurface.variant,
                    background: theme.palette.surface.container,
                  },
                  disableUnderline: true,
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon sx={{ color: 'onSurface.variant' }} />
                    </InputAdornment>
                  ),
                }}
                value={searchString}
                onChange={(e) => setSearchString(e.target.value)}
                autoFocus
                inputRef={inputRef}
                onClick={() => setFocusedIndex(-1)}
                sx={{
                  flexGrow: 1,
                  '& .MuiInputBase-root': {
                    color: 'surface.container',
                    '&::placeholder': {
                      color: 'surface.container',
                    },
                  },
                }}
              />
            </Box>
            <Box
              sx={{
                maxHeight: '35vh',
                overflowY: 'auto',
                '&::-webkit-scrollbar': {
                  width: '6px',
                },
                '&::-webkit-scrollbar-track': {
                  backgroundColor: 'transparent',
                },
                '&::-webkit-scrollbar-thumb': {
                  backgroundColor: 'grey.500',
                  borderRadius: '3px',
                },
              }}
            >
              {renderResults()}
            </Box>
          </Box>
        </Box>
      </Fade>
    </Modal>
  );
};

export default GlobalSearchModal;
