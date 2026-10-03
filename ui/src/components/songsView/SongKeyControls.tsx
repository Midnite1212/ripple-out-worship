import {
  Box,
  Chip,
  FormControlLabel,
  IconButton,
  Stack,
  Switch,
  Typography,
  styled,
} from '@mui/material';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';

type SongKeyControlsProps = {
  isDesktop: boolean;
  split: number;
  onSplit: () => void;
  isChordsShown: boolean;
  onChordsShownChange: (isShown: boolean) => void;
  isFlat: boolean;
  onFlatChange: (isFlat: boolean) => void;
  keyLabel: string;
  onTransposeDown: () => void;
  onTransposeUp: () => void;
};

const ControlPill = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexShrink: 0,
  alignItems: 'center',
  justifyContent: 'center',
  background: theme.palette.surface.containerHighest,
  borderRadius: '30px',
}));

const ToggleSwitch = styled(Switch)(({ theme }) => ({
  '& .Mui-checked': { color: theme.palette.secondary.main },
  '& .Mui-checked + .MuiSwitch-track': { backgroundColor: theme.palette.switchTrack.checked },
}));

const transposeButtonSx = {
  bgcolor: 'primary.dark',
  borderRadius: '4px',
  p: 0,
  width: { xs: '24px', sm: 'auto' },
  height: { xs: '24px', sm: 'auto' },
  '&:hover': { bgcolor: 'primary.dark' },
};

const SongKeyControls = ({
  isDesktop,
  split,
  onSplit,
  isChordsShown,
  onChordsShownChange,
  isFlat,
  onFlatChange,
  keyLabel,
  onTransposeDown,
  onTransposeUp,
}: SongKeyControlsProps) => {
  const pillSx = { height: isDesktop ? '56px' : '48px', px: isDesktop ? 2 : 1.25 };

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: isDesktop ? 2 : 1,
        pr: isDesktop ? 2 : 0,
        overflowX: 'auto',
        whiteSpace: 'nowrap',
        scrollbarWidth: isDesktop ? 'thin' : 'none',
        '&::-webkit-scrollbar': isDesktop ? { height: 6 } : { display: 'none' },
        '&::-webkit-scrollbar-thumb': { backgroundColor: 'scrollbar.thumb', borderRadius: 4 },
      }}
    >
      <ControlPill sx={{ ...pillSx, gap: 2 }}>
        <Typography color="primary.lighter">Split</Typography>
        <IconButton
          aria-label="split columns"
          onClick={onSplit}
          sx={{
            bgcolor: 'primary.main',
            height: '30px',
            width: '30px',
            borderRadius: '4px',
            p: 0,
            '&:hover': { bgcolor: 'primary.main' },
          }}
        >
          <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.2}>
            {Array.from({ length: split }, (_, i) => (
              <Box
                key={i}
                bgcolor="primary.lightest"
                height="15px"
                width="6px"
                borderRadius="2px"
              />
            ))}
          </Stack>
        </IconButton>
      </ControlPill>

      <ControlPill sx={pillSx}>
        <FormControlLabel
          labelPlacement="start"
          sx={{ color: 'primary.lighter' }}
          control={
            <ToggleSwitch
              checked={isChordsShown}
              onChange={(_, checked) => onChordsShownChange(checked)}
              name="chords"
            />
          }
          label="Chords"
        />
      </ControlPill>

      {isChordsShown && (
        <>
          <ControlPill sx={{ ...pillSx, gap: { xs: 0.2, sm: 2 } }}>
            <Typography color="primary.lighter" px={0.75}>
              Key
            </Typography>
            <IconButton
              aria-label="transpose down"
              onClick={onTransposeDown}
              sx={transposeButtonSx}
            >
              <KeyboardArrowDownIcon sx={{ color: 'primary.lightest' }} />
            </IconButton>
            <Chip label={keyLabel} sx={{ background: (theme) => theme.palette.outline.variant }} />
            <IconButton aria-label="transpose up" onClick={onTransposeUp} sx={transposeButtonSx}>
              <KeyboardArrowUpIcon sx={{ color: 'primary.lightest' }} />
            </IconButton>
          </ControlPill>

          <ControlPill sx={pillSx}>
            <FormControlLabel
              labelPlacement="start"
              sx={{ color: 'secondary.main' }}
              control={
                <ToggleSwitch
                  checked={isFlat}
                  onChange={(_, checked) => onFlatChange(checked)}
                  name="flat"
                />
              }
              label="Flat"
            />
          </ControlPill>
        </>
      )}
    </Box>
  );
};

export default SongKeyControls;
