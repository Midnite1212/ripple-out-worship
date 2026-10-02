import { Box, Button, Stack } from '@mui/material';
import Delete from '@mui/icons-material/Delete';

type SetlistFolderDrawerFooterProps = {
  mode: 'edit' | 'create';
  isSaveDisabled: boolean;
  onCancel: () => void;
  onSave: () => void;
  onDelete: () => void;
};

const SetlistFolderDrawerFooter = ({
  mode,
  isSaveDisabled,
  onCancel,
  onSave,
  onDelete,
}: SetlistFolderDrawerFooterProps) => (
  <>
    {mode === 'create' && (
      <Box sx={{ position: 'absolute', bottom: 12, width: '100%' }}>
        <Stack direction="row" spacing={2} px={2} width="100%">
          <Button
            variant="outlined"
            sx={{
              width: '50%',
              color: 'secondary.light',
              borderRadius: '40px',
              textTransform: 'none',
              border: (theme) => `1px solid ${theme.palette.outline.main}`,
            }}
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            variant="outlined"
            sx={{
              width: '50%',
              backgroundColor: 'secondary.main',
              color: 'primary.main',
              borderRadius: '40px',
              textTransform: 'none',
            }}
            onClick={onSave}
            disabled={isSaveDisabled}
          >
            Save
          </Button>
        </Stack>
      </Box>
    )}
    {mode === 'edit' && (
      <Box sx={{ position: 'absolute', bottom: '1.125rem', left: '1.125rem' }}>
        <Button
          onClick={onDelete}
          sx={{
            color: 'error.main',
            borderRadius: '40px',
            backgroundColor: 'transparent',
            textTransform: 'none',
            gap: '0.75rem',
            padding: '8px 20px',
            '&:hover': {
              backgroundColor: 'rgba(239, 184, 200, 0.15)',
            },
          }}
        >
          <Delete sx={{ color: 'error.main' }} />
          Delete Folder
        </Button>
      </Box>
    )}
  </>
);

export default SetlistFolderDrawerFooter;
