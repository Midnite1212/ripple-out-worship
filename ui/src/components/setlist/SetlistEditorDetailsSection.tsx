import { Dispatch, SetStateAction } from 'react';
import { Box, FormControl, Stack, TextField } from '@mui/material';
import Info from '@mui/icons-material/Info';
import MusicNote from '@mui/icons-material/MusicNote';
import { DatePicker, LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { Dayjs } from 'dayjs';
import { Control, Controller, FieldErrors } from 'react-hook-form';
import AutocompleteInput from '../custom/AutocompleteInput';
import HeaderWithIcon from '../custom/HeaderWithIcon';
import SetlistSongsTable from './SetlistSongsTable';
import { SetlistEditorFields, SetlistFolder } from '../../types/setlist.types';
import { SongSetlistSchema } from '../../types/song.types';
import { SetlistDetailsBox, SetlistDetailsContent } from './SetlistEditor.styles';

type SetlistEditorDetailsSectionProps = {
  control: Control<SetlistEditorFields>;
  errors: FieldErrors<SetlistEditorFields>;
  date: Dayjs | null;
  onDateChange: (date: Dayjs | null) => void;
  folderOptions: SetlistFolder[];
  folderList: string[];
  onFolderChange: (folders: string[]) => void;
  addedSongList: SongSetlistSchema[];
  setAddedSongList: Dispatch<SetStateAction<SongSetlistSchema[]>>;
  isMobileOrSmallTablet: boolean;
};

const SetlistEditorDetailsSection = ({
  control,
  errors,
  date,
  onDateChange,
  folderOptions,
  folderList,
  onFolderChange,
  addedSongList,
  setAddedSongList,
  isMobileOrSmallTablet,
}: SetlistEditorDetailsSectionProps) => (
  <SetlistDetailsBox isMobileOrSmallTablet={isMobileOrSmallTablet}>
    <SetlistDetailsContent isMobileOrSmallTablet={isMobileOrSmallTablet} direction="column">
      <HeaderWithIcon
        Icon={Info}
        headerText="Details"
        headerVariant="h3"
        iconColor="secondary.main"
        headerColor="secondary.main"
      />

      <Controller
        name="name"
        control={control}
        defaultValue=""
        render={({ field }) => (
          <TextField
            id="name"
            label="Title"
            error={!!errors.name}
            helperText={errors?.name?.message}
            {...field}
          />
        )}
      />

      <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale="en">
        <DatePicker label="Date" value={date} onChange={onDateChange} />
      </LocalizationProvider>

      <FormControl fullWidth>
        <AutocompleteInput
          id="folders"
          options={folderOptions.map((folder) => folder.groupName)}
          label="Folders"
          autoComplete="folders"
          value={folderList}
          onChange={(_, newValue) => onFolderChange(newValue as string[])}
          multiple
        />
      </FormControl>

      {!isMobileOrSmallTablet && (
        <Box sx={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Stack direction="column" spacing={'1rem'} sx={{ height: '100%' }}>
            <HeaderWithIcon
              Icon={MusicNote}
              headerText="Songs"
              headerVariant="h3"
              iconColor="secondary.main"
              headerColor="secondary.main"
            />
            <Box sx={{ flex: 1, overflow: 'auto' }}>
              <SetlistSongsTable songList={addedSongList} setSongList={setAddedSongList} />
            </Box>
          </Stack>
        </Box>
      )}
    </SetlistDetailsContent>
  </SetlistDetailsBox>
);

export default SetlistEditorDetailsSection;
