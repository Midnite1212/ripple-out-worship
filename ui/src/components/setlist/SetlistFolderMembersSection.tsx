import { Box, Button, List, ListItem, Stack, Typography } from '@mui/material';
import GroupAdd from '@mui/icons-material/GroupAdd';
import SetlistFolderPersonListItem from './SetlistFolderPersonListItem';
import { Ownership } from '../../types/ownership.types';

type SetlistFolderMembersSectionProps = {
  members: Ownership[];
  onAddPeople: () => void;
  onRemoveMember: (person: Ownership) => void;
};

const SetlistFolderMembersSection = ({
  members,
  onAddPeople,
  onRemoveMember,
}: SetlistFolderMembersSectionProps) => (
  <Box sx={{ p: '1.125rem' }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="h4" color="primary.lightest">
        Members
      </Typography>
      <Button
        startIcon={<GroupAdd />}
        onClick={onAddPeople}
        sx={{
          color: 'secondary.main',
          padding: '8px 20px',
          borderRadius: '40px',
          '&:hover': {
            backgroundColor: 'rgba(208, 188, 255, 0.15)',
          },
        }}
      >
        Add people
      </Button>
    </Stack>
    <List>
      {members.length > 0 ? (
        members.map((person) => (
          <SetlistFolderPersonListItem
            key={person.userId}
            person={person}
            onRemove={onRemoveMember}
          />
        ))
      ) : (
        <ListItem>
          <Typography variant="subtitle1" color="primary.lighter">
            No members added
          </Typography>
        </ListItem>
      )}
    </List>
  </Box>
);

export default SetlistFolderMembersSection;
