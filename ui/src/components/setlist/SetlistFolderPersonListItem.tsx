import { IconButton, ListItem, Stack, Typography } from '@mui/material';
import { Ownership } from '../../types/ownership.types';

type SetlistFolderPersonListItemProps = {
  person: Ownership;
  onRemove: (person: Ownership) => void;
};

const SetlistFolderPersonListItem = ({ person, onRemove }: SetlistFolderPersonListItemProps) => (
  <ListItem
    secondaryAction={
      <IconButton
        edge="end"
        onClick={() => onRemove(person)}
        sx={{
          padding: '8px 20px',
          borderRadius: '40px',
          '&:hover': {
            backgroundColor: 'rgba(239, 184, 200, 0.15)',
          },
        }}
      >
        <Typography component="span" variant="body2" color="error.main" fontWeight={700}>
          Remove
        </Typography>
      </IconButton>
    }
  >
    <Stack direction="column" color={'primary.lighter'}>
      <Typography variant="body1" fontWeight={700}>
        {person.fullName}
      </Typography>
    </Stack>
  </ListItem>
);

export default SetlistFolderPersonListItem;
