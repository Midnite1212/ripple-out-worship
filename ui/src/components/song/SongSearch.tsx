import {
  Box,
  Button,
  Chip,
  Container,
  Dialog,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { Dispatch, SetStateAction, useState } from 'react';
import ArrowDropDown from '@mui/icons-material/ArrowDropDown';
import CloseIcon from '@mui/icons-material/Close';
import Info from '@mui/icons-material/Info';
import Refresh from '@mui/icons-material/Refresh';
import Tune from '@mui/icons-material/Tune';
import HeaderWithIcon from '../custom/HeaderWithIcon';
import useSongFilters from './useSongFilters';
import { SongSearchProps } from '../../types/song.types';
import { displayResultOptions, tempoOptions, themeOptions } from '../../constants';

type FilterChipSectionProps = {
  label: string;
  options: string[];
  selected: string[];
  onChange: Dispatch<SetStateAction<string[]>>;
};

const FilterChipSection = ({ label, options, selected, onChange }: FilterChipSectionProps) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" pb="0.5rem">
        <Typography variant="body1" fontWeight={700} color="primary.lighter">
          {label}
        </Typography>
        <IconButton
          aria-label={isOpen ? `Collapse ${label}` : `Expand ${label}`}
          onClick={() => setIsOpen((prev) => !prev)}
          sx={{
            p: 0,
            transform: isOpen ? 'none' : 'rotate(-180deg)',
            transition: '0.1s ease-in-out',
          }}
          disableRipple
        >
          <ArrowDropDown sx={{ color: 'onSurface.variant' }} />
        </IconButton>
      </Stack>
      {isOpen &&
        options.map((item) => {
          const isSelected = selected.includes(item);
          return (
            <Chip
              key={item}
              label={item}
              onClick={isSelected ? undefined : () => onChange((prev) => [...prev, item])}
              onDelete={
                isSelected
                  ? () => onChange((prev) => prev.filter((chip) => chip !== item))
                  : undefined
              }
              sx={{
                bgcolor: isSelected ? 'primary.dark' : 'secondary.lighter',
                borderRadius: '8px',
                m: 0.5,
                '&:hover': { bgcolor: 'primary.dark' },
              }}
            />
          );
        })}
    </Box>
  );
};

const SongSearch = ({ isMobile, setFilterData }: SongSearchProps) => {
  const {
    displayResultList,
    resetFilters,
    searchString,
    setDisplayResultList,
    setSearchString,
    setTempoList,
    setThemeList,
    tempoList,
    themeList,
  } = useSongFilters(setFilterData);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  const closeFilterDialog = () => setIsFilterDialogOpen(false);

  const filterHeader = (
    <Stack
      direction="row"
      alignItems="center"
      justifyContent="space-between"
      height={isMobile ? 'auto' : '4%'}
      pb={isMobile ? 3 : 0}
    >
      <HeaderWithIcon
        Icon={Tune}
        headerText="Filter"
        headerVariant="h3"
        headerColor="common.white"
      />
      <Stack direction="row" alignItems="center">
        <Button
          sx={{
            p: '7.5px 15px',
            borderRadius: '10px',
            bgcolor: 'common.black',
            color: 'secondary.main',
            textTransform: 'none',
          }}
          startIcon={<Refresh />}
          onClick={resetFilters}
        >
          Reset All
        </Button>
        {isMobile && (
          <IconButton aria-label="Close filters" onClick={closeFilterDialog}>
            <CloseIcon sx={{ color: 'common.white' }} />
          </IconButton>
        )}
      </Stack>
    </Stack>
  );

  const filterFields = (
    <Stack spacing="1.25rem">
      <Box>
        <Typography variant="body1" fontWeight={700} color="primary.lighter" pb="0.5rem">
          Search Keywords
        </Typography>
        <TextField
          variant="standard"
          placeholder="Type Song Title, Keywords, etc"
          InputProps={{
            disableUnderline: true,
            sx: {
              fontSize: '1rem',
              color: 'onSurface.variant',
              bgcolor: 'secondary.lighter',
              borderRadius: '8px',
              px: 2,
              py: 1,
            },
          }}
          fullWidth
          value={searchString}
          onChange={(e) => setSearchString(e.target.value)}
          autoFocus={!isMobile}
        />
      </Box>
      <FilterChipSection
        label="Tempo"
        options={tempoOptions}
        selected={tempoList}
        onChange={setTempoList}
      />
      <FilterChipSection
        label="Themes"
        options={themeOptions}
        selected={themeList}
        onChange={setThemeList}
      />
      <FilterChipSection
        label="Display Results Details"
        options={displayResultOptions}
        selected={displayResultList}
        onChange={setDisplayResultList}
      />
      <Stack
        direction="row"
        alignItems="center"
        spacing="0.5rem"
        sx={{ border: 1, p: 1, borderRadius: '4px', borderColor: '#625B71' }}
      >
        <Info sx={{ color: 'onSecondaryContainer.main' }} />
        <Typography variant="body2">Song Title will be displayed by default</Typography>
      </Stack>
    </Stack>
  );

  return isMobile ? (
    <Container maxWidth={false} sx={{ py: '1em' }} disableGutters>
      <Stack direction="row" spacing="0.5em">
        <TextField
          variant="standard"
          placeholder="Search"
          InputProps={{
            disableUnderline: true,
            sx: {
              fontSize: '1rem',
              color: 'onSurface.variant',
              bgcolor: 'secondary.lighter',
              borderRadius: '26px',
              px: 2,
              py: 1,
            },
          }}
          fullWidth
          value={searchString}
          onChange={(e) => setSearchString(e.target.value)}
          autoFocus
        />
        <IconButton
          aria-label="Open filters"
          onClick={() => setIsFilterDialogOpen(true)}
          sx={{
            flexShrink: 0,
            bgcolor: 'secondary.main',
            color: 'onPrimary.main',
            p: '10px',
            width: '48px',
            height: '48px',
            '&:hover': { bgcolor: 'secondary.main', opacity: 0.95 },
          }}
        >
          <Tune />
        </IconButton>
      </Stack>
      <Dialog
        fullScreen
        open={isFilterDialogOpen}
        onClose={closeFilterDialog}
        PaperProps={{
          sx: {
            bgcolor: 'common.black',
            border: 0,
            borderRadius: 0,
            color: 'grey.500',
            p: '1em',
          },
        }}
      >
        {filterHeader}
        <Box flex={1} minHeight={0} pr={1} pb={2} sx={{ overflowY: 'auto' }}>
          {filterFields}
        </Box>
        <Button
          onClick={closeFilterDialog}
          sx={{
            flexShrink: 0,
            p: '8px 15px',
            borderRadius: '40px',
            bgcolor: 'secondary.main',
            textTransform: 'none',
            width: '100%',
            '&:hover': { bgcolor: 'secondary.main', opacity: 0.95 },
            transition: 'all 0.1s ease-in-out',
          }}
        >
          <Typography variant="h4" component="span" color="onPrimary.main">
            Apply
          </Typography>
        </Button>
      </Dialog>
    </Container>
  ) : (
    <Container
      sx={{ p: '1rem', bgcolor: 'common.black', borderRadius: '16px', height: '100%' }}
      disableGutters
    >
      <Box color="grey.500" height="100%">
        {filterHeader}
        <Box height="95%" pb={4} sx={{ overflowY: 'auto' }}>
          {filterFields}
        </Box>
      </Box>
    </Container>
  );
};

export default SongSearch;
