import { Box, Chip, Grid, Typography } from '@mui/material';
import { SongViewSchema } from '../../types/song.types';

type SongInfoDetailsProps = {
  song: SongViewSchema;
};

type SongInfoRow = {
  label: string;
  value: string | string[] | undefined;
};

const SongInfoDetails = ({ song }: SongInfoDetailsProps) => {
  const rows: SongInfoRow[] = [
    { label: 'Themes', value: song.themes },
    { label: 'Tempo', value: song.tempo },
    { label: 'Time Signature', value: song.timeSignature },
    { label: 'Original Key', value: song.originalKey },
    { label: 'Recommended Keys', value: song.recommendedKeys },
    { label: 'Year', value: song.year },
    { label: 'Code', value: song.code },
  ];
  const filledRows = rows.filter(({ value }) => (Array.isArray(value) ? value.length > 0 : value));

  return (
    <Grid container spacing={1}>
      {filledRows.map(({ label, value }) => (
        <Grid container item xs={12} key={label}>
          <Grid item xs={4}>
            <Typography color="outline.main">{label}</Typography>
          </Grid>
          <Grid item xs={8}>
            {Array.isArray(value) ? (
              <Box display="flex" flexWrap="wrap" gap={0.5}>
                {value.map((item) => (
                  <Chip
                    key={item}
                    label={item}
                    size="small"
                    sx={{ bgcolor: 'surface.containerHigh', color: 'onSurface.secondary' }}
                  />
                ))}
              </Box>
            ) : (
              <Typography color="onSurface.secondary">{value}</Typography>
            )}
          </Grid>
        </Grid>
      ))}
    </Grid>
  );
};

export default SongInfoDetails;
