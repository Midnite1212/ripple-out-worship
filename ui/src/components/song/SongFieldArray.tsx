import { FieldArrayProps } from '../../types/song.types';
import { Typography, Stack, Chip } from '@mui/material';

const SongFieldArray = ({ data }: FieldArrayProps) => {
  if (Array.isArray(data)) {
    if (data.length === 0) return <Typography color={'onSurface.secondary'}>-</Typography>;
    return (
      <Stack spacing={1} direction="row" flexWrap="wrap">
        {data.map((item: string, i: number) => {
          return (
            <Chip
              size="small"
              key={i}
              label={item}
              sx={{ bgcolor: 'surface.containerHigh', color: 'onSurface.secondary' }}
            />
          );
        })}
      </Stack>
    );
  }
  return null;
};

export default SongFieldArray;
