import { UIEvent } from 'react';
import { Typography } from '@mui/material';
import AddCircleOutline from '@mui/icons-material/AddCircleOutline';
import HeaderWithIcon from '../custom/HeaderWithIcon';
import SetlistEditorSongCard from './SetlistEditorSongCard';
import { SongSchema, SongSearchFilter } from '../../types/song.types';
import {
  SearchContainer,
  SearchIcon,
  SongResultsContainer,
  SongSearchBox,
  SongSearchContent,
  SongSearchInput,
  SongSearchStack,
} from './SetlistEditor.styles';

type SetlistEditorSongSearchSectionProps = {
  filterData: SongSearchFilter | undefined;
  setFilterData: (value: SongSearchFilter) => void;
  songResults: SongSchema[];
  isLoading: boolean;
  isMobileOrSmallTablet: boolean;
  isTablet: boolean;
  onAddSong: (id: string) => void;
  onResultsScroll: (event: UIEvent<HTMLDivElement>) => void;
  addedSongIds: string[];
  showHeader?: boolean;
};

const SetlistEditorSongSearchSection = ({
  filterData,
  setFilterData,
  songResults,
  isLoading,
  isMobileOrSmallTablet,
  isTablet,
  onAddSong,
  onResultsScroll,
  addedSongIds,
  showHeader = true,
}: SetlistEditorSongSearchSectionProps) => (
  <SongSearchBox isMobileOrSmallTablet={isMobileOrSmallTablet} isTablet={isTablet}>
    <SongSearchContent>
      {showHeader && (
        <HeaderWithIcon
          Icon={AddCircleOutline}
          headerText={isMobileOrSmallTablet ? 'Add Songs' : 'Search to Add Songs'}
          headerVariant="h3"
          iconColor="secondary.main"
          headerColor="secondary.main"
        />
      )}

      <SongSearchStack>
        <SearchInput
          searchString={filterData?.search || ''}
          onSearchChange={(value) => {
            setFilterData({ ...filterData, search: value });
          }}
        />

        <SongResultsContainer onScroll={onResultsScroll}>
          {songResults.length > 0
            ? songResults.map((song) => (
                <SetlistEditorSongCard
                  key={song._id}
                  song={song}
                  isMobileOrSmallTablet={isMobileOrSmallTablet}
                  onAddSong={onAddSong}
                  isAdded={addedSongIds.includes(song._id)}
                />
              ))
            : !isLoading &&
              !!filterData?.search && (
                <Typography>No songs found for "{filterData.search}"</Typography>
              )}
        </SongResultsContainer>
      </SongSearchStack>
    </SongSearchContent>
  </SongSearchBox>
);

const SearchInput = ({
  searchString,
  onSearchChange,
}: {
  searchString: string;
  onSearchChange: (value: string) => void;
}) => (
  <SearchContainer>
    <SearchIcon />
    <SongSearchInput
      placeholder="Search songs..."
      value={searchString}
      fullWidth
      onChange={(e) => onSearchChange(e.target.value)}
    />
    {/* TODO: Implement song filter panel */}
  </SearchContainer>
);

export default SetlistEditorSongSearchSection;
