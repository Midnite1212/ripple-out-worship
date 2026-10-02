import { useState, useRef, useEffect, useCallback } from 'react';
import { Box, Divider } from '@mui/material';
import SetlistViewSongsHeader from './SetlistViewSongsHeader';
import SetlistViewSongDisplay from './SetlistViewSongDisplay';
import { SongSetlistSchema, SongViewSchema } from '../../types/song.types';

interface SetlistViewSongsProps {
  songs: SongSetlistSchema[];
}

const SetlistViewSongs = ({ songs }: SetlistViewSongsProps) => {
  // Global state
  const [showChords, setShowChords] = useState(false);
  const [splitColumns, setSplitColumns] = useState(1);
  const [selectedSong, setSelectedSong] = useState<SongViewSchema | undefined>(songs[0]);

  useEffect(() => {
    setSelectedSong((prev) => songs.find((song) => song._id === prev?._id) ?? songs[0]);
  }, [songs]);

  // Refs for auto-scroll
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const songRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Memoized handlers
  const handleChordsToggle = useCallback((chords: boolean) => {
    setShowChords(chords);
  }, []);

  const handleSplitChange = useCallback((split: number) => {
    setSplitColumns(split);
  }, []);

  // Scroll to song helper
  const scrollToSong = useCallback((songId: string) => {
    const songElement = songRefs.current[songId];
    const scrollContainer = scrollContainerRef.current;

    if (songElement && scrollContainer) {
      const scrollPosition = songElement.offsetTop - scrollContainer.offsetTop;
      scrollContainer.scrollTo({
        top: scrollPosition,
        behavior: 'smooth',
      });
    }
  }, []);

  const handleSongSelection = useCallback(
    (song: SongViewSchema) => {
      setSelectedSong(song);
      const songId = song._id || `song-${songs.findIndex((s) => s._id === song._id)}`;
      scrollToSong(songId);
    },
    [songs, scrollToSong]
  );

  // Set ref for song element
  const setSongRef = useCallback((songId: string, element: HTMLDivElement | null) => {
    songRefs.current[songId] = element;
  }, []);

  // Container styles
  const containerStyles = {
    maxWidth: '100%',
    maxHeight: '100%',
    p: 0,
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  };

  const scrollableStyles = {
    mt: '1rem',
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    overflowY: 'auto',
    flex: 1,
    minHeight: 0,
  };

  const emptyStateStyles = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '300px',
    color: '#888',
    fontSize: '18px',
  };

  return (
    <Box sx={containerStyles}>
      {/* Fixed Global Controls */}
      <Box sx={{ flexShrink: 0 }}>
        <SetlistViewSongsHeader
          songs={songs}
          selectedSong={selectedSong}
          setSelectedSong={handleSongSelection}
          split={splitColumns}
          onSplitChange={handleSplitChange}
          showChords={showChords}
          onChordsToggle={handleChordsToggle}
        />
      </Box>

      {/* Scrollable Song List */}
      <Box ref={scrollContainerRef} sx={scrollableStyles}>
        {songs.map((song, index) => {
          const songId = song._id || `song-${index}`;
          const isLastSong = index === songs.length - 1;

          return (
            <div key={songId}>
              <Box ref={(el: HTMLDivElement | null) => setSongRef(songId, el)}>
                <SetlistViewSongDisplay
                  song={song}
                  splitColumns={splitColumns}
                  showChords={showChords}
                />
              </Box>
              {!isLastSong && <Divider sx={{ borderColor: 'outline.main' }} />}
            </div>
          );
        })}

        {/* Empty State */}
        {songs.length === 0 && <Box sx={emptyStateStyles}>No songs in setlist</Box>}
      </Box>
    </Box>
  );
};

export default SetlistViewSongs;
