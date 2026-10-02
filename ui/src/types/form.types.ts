type RegisterFormFields = {
  fullName: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type LoginFormFields = Omit<RegisterFormFields, 'fullName' | 'confirmPassword'>;

type RecoverPasswordFields = Omit<LoginFormFields, 'password'>;

type ResetPasswordFields = Omit<RegisterFormFields, 'fullName' | 'email'>;

type SongEditorFormFields = {
  title: string;
  artist: string;
  originalKey: string;
  themes: string[];
  tempo: string[];
  timeSignature: string[];
  recommendedKeys: string[];
  year?: string | null;
  code?: string | null;
  chordLyrics: string;
  simplifiedChordLyrics?: string | null;
};

export type {
  LoginFormFields,
  RegisterFormFields,
  RecoverPasswordFields,
  ResetPasswordFields,
  SongEditorFormFields,
};
