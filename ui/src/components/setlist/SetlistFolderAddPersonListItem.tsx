import { IconButton, ListItem, Stack, Typography } from '@mui/material';
import Add from '@mui/icons-material/Add';
import Check from '@mui/icons-material/Check';
import { Ownership } from '../../types/ownership.types';

type SetlistFolderAddPersonListItemProps = {
  person: Ownership;
  isAdded: boolean;
  onToggle: (userId: string) => void;
};

const SetlistFolderAddPersonListItem = ({
  person,
  isAdded,
  onToggle,
}: SetlistFolderAddPersonListItemProps) => (
  <ListItem
    sx={{ borderBottom: (theme) => `1px solid ${theme.palette.outline.variant}`, p: '1rem' }}
    secondaryAction={
      <IconButton
        edge="end"
        onClick={() => onToggle(person.userId)}
        sx={{
          width: '30px',
          height: '30px',
          border: 1,
          borderRadius: '50%',
          borderWidth: '2px',
          color: 'primary.lighter',
          '&:hover': { color: 'secondary.main' },
          '&.Mui-selected': {
            backgroundColor: 'secondary.main',
            color: 'primary.darkest',
          },
        }}
        className={isAdded ? 'Mui-selected' : ''}
      >
        {isAdded ? <Check /> : <Add />}
      </IconButton>
    }
  >
    <Stack direction="column">
      <Typography variant="subtitle1">{person.fullName}</Typography>
    </Stack>
  </ListItem>
);

export default SetlistFolderAddPersonListItem;
