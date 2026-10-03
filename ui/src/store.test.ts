import { fetchOwnership, fetchSongs } from './reducers';
import { signin, signout } from './reducers/userSlice';
import { persistor, store } from './store';
import { Ownership } from './types/ownership.types';
import { SongSchema } from './types/song.types';

const initialState = {
  user: '',
  songs: [],
  ownership: {
    userId: '',
    fullName: '',
    accessType: '',
    groupIds: [],
    setlistIds: [],
    isDeleted: false,
  },
};

const sliceState = () => {
  const { user, songs, ownership } = store.getState();
  return { user, songs, ownership };
};

const song = { _id: 'song-1', title: 'Song', code: 'A1' } as SongSchema;

const ownership: Ownership = {
  userId: 'user-1',
  fullName: 'Test User',
  accessType: 'admin',
  groupIds: [{ id: 'group-1', name: 'Group', createdAt: '2026-10-01' }],
  setlistIds: [{ id: 'setlist-1', name: 'Sunday', createdAt: '2026-10-01' }],
  isDeleted: false,
};

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      if (persistor.getState().bootstrapped) return resolve();
      const unsubscribe = persistor.subscribe(() => {
        if (!persistor.getState().bootstrapped) return;
        unsubscribe();
        resolve();
      });
    })
);

describe('store', () => {
  it('starts every slice at its initial state', () => {
    expect(sliceState()).toEqual(initialState);
  });

  it('keeps state on unrelated actions', () => {
    store.dispatch(signin('token-1'));
    store.dispatch(fetchSongs([song]));
    store.dispatch(fetchOwnership(ownership));
    store.dispatch({ type: 'unrelated/action' });

    expect(sliceState()).toEqual({ user: 'token-1', songs: [song], ownership });
  });

  it('resets every slice on signout', () => {
    store.dispatch(signin('token-2'));
    store.dispatch(fetchSongs([song]));
    store.dispatch(fetchOwnership(ownership));

    store.dispatch(signout());

    expect(sliceState()).toEqual(initialState);
  });

  it('keeps redux-persist metadata after signout', () => {
    store.dispatch(signout());
    expect(store.getState()._persist).toEqual(expect.objectContaining({ rehydrated: true }));
  });
});
