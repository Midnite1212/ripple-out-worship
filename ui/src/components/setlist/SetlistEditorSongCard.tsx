import { Stack, Typography } from '@mui/material';
import Add from '@mui/icons-material/Add';
import Check from '@mui/icons-material/Check';
import SongFieldArray from '../song/SongFieldArray';
import { SongSchema } from '../../types/song.types';
import {
  AddButton,
  DetailField,
  SongCard,
  SongCardHeader,
  SongDetails,
} from './SetlistEditor.styles';

type SongCardData = Pick<
  SongSchema,
  'themes' | 'tempo' | 'originalKey' | 'year' | 'code' | 'timeSignature'
>;

const SONG_CARD_FIELDS: { key: keyof SongCardData; label: string }[] = [
  { key: 'themes', label: 'Themes' },
  { key: 'tempo', label: 'Tempo' },
  { key: 'originalKey', label: 'Key' },
  { key: 'year', label: 'Year' },
  { key: 'code', label: 'Code' },
  { key: 'timeSignature', label: 'Time' },
];

type SetlistEditorSongCardProps = {
  song: SongSchema;
  isMobileOrSmallTablet: boolean;
  onAddSong: (id: string) => void;
  isAdded: boolean;
};

const SetlistEditorSongCard = ({
  song,
  isMobileOrSmallTablet,
  onAddSong,
  isAdded,
}: SetlistEditorSongCardProps) => {
  const { _id, title, artist, themes, tempo, originalKey, year, code, timeSignature } = song;

  const songData: SongCardData = { themes, tempo, originalKey, year, code, timeSignature };

  return (
    <SongCard disableGutters>
      <SongCardHeader direction="row">
        <Stack>
          <Typography variant="h4" color="secondary.main">
            {title}
          </Typography>
          <Typography variant="subtitle2" color="secondary.main">
            {artist}
          </Typography>
        </Stack>

        <AddSongButton isAdded={isAdded} onClick={() => onAddSong(_id)} />
      </SongCardHeader>

      <SongDetailsList data={songData} isMobileOrSmallTablet={isMobileOrSmallTablet} />
    </SongCard>
  );
};

const AddSongButton = ({ isAdded, onClick }: { isAdded: boolean; onClick: () => void }) => (
  <AddButton onClick={onClick} isAdded={isAdded}>
    {isAdded ? <Check sx={{ fontSize: '20px' }} /> : <Add sx={{ fontSize: '20px' }} />}
  </AddButton>
);

const SongDetailsList = ({
  data,
  isMobileOrSmallTablet,
}: {
  data: SongCardData;
  isMobileOrSmallTablet: boolean;
}) => (
  <SongDetails direction={isMobileOrSmallTablet ? 'column' : 'row'}>
    {SONG_CARD_FIELDS.map((field) => (
      <SongDetailField
        key={field.key}
        label={field.label}
        value={data[field.key]}
        isMobileOrSmallTablet={isMobileOrSmallTablet}
      />
    ))}
  </SongDetails>
);

const SongDetailField = ({
  label,
  value,
  isMobileOrSmallTablet,
}: {
  label: string;
  value: SongCardData[keyof SongCardData];
  isMobileOrSmallTablet: boolean;
}) => (
  <DetailField spacing={'0.5rem'} mr={isMobileOrSmallTablet ? 0 : '1rem'} direction={'row'}>
    <Typography variant="body2" color="grey.500" minWidth="fit-content">
      {label}
    </Typography>
    {Array.isArray(value) ? (
      <SongFieldArray data={value} />
    ) : (
      <Typography variant="body2" color="onSurface.secondary" align="left" noWrap>
        {value ?? '-'}
      </Typography>
    )}
  </DetailField>
);

export default SetlistEditorSongCard;
