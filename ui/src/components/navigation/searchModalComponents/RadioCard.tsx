import { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';

type RadioCardProps = {
  children: ReactNode;
  isSelected: boolean;
  onClick: () => void;
};

const RadioCard = ({ children, isSelected, onClick }: RadioCardProps) => {
  return (
    <Box
      sx={{
        cursor: 'pointer',
        border: 1,
        borderRadius: '5px',
        borderColor: isSelected ? 'primary.dark' : 'outline.main',
        backgroundColor: isSelected ? 'primary.dark' : 'surface.containerHigh',
        fontWeight: isSelected ? '500' : 'normal',
        px: '0.6rem',
        py: '0.3rem',
      }}
      onClick={onClick}
    >
      <Typography
        variant="body2"
        fontWeight={isSelected ? '500' : 'normal'}
        color="onSurface.variant"
      >
        {children}
      </Typography>
    </Box>
  );
};

export default RadioCard;
