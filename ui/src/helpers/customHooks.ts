import { isAxiosError } from 'axios';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { customAxios as axios, updateAxiosClient } from '../components/custom/customAxios';
import { fetchOwnership, fetchSongs } from '../reducers';
import { signout } from '../reducers/userSlice';
import { persistor, useAppSelector } from '../store';
import { Ownership } from '../types/ownership.types';
import { Setlist } from '../types/setlist.types';
import { SongSchema } from '../types/song.types';
import { User } from '../types/user.types';
import { logRequestError } from './global';

type VerifiedSession = {
  token: string;
  user?: User;
};

export const useUser = (): { token: string; user?: User; loading: boolean } => {
  const token = useAppSelector((state) => state.user);
  const dispatch = useDispatch();
  const hasToken = typeof token === 'string' && token.length > 0;
  const [session, setSession] = useState<VerifiedSession>();

  useEffect(() => {
    if (!hasToken) {
      return;
    }
    let ignore = false;
    const verifySession = async () => {
      let verifiedUser: User | undefined;
      try {
        const { data } = await axios.post<User>('/external-api/auth/verify-token', { token });
        if (ignore) {
          return;
        }
        updateAxiosClient(token);
        verifiedUser = data;
        const { data: ownershipData, status } = await axios.get<Ownership>('/api/ownerships/get', {
          params: { userId: data.id },
          validateStatus: (responseStatus) => responseStatus === 200 || responseStatus === 404,
        });
        if (ignore) {
          return;
        }
        if (status === 404) {
          const { data: createdOwnership } = await axios.post<Ownership>('/api/ownerships/create', {
            userId: data.id,
            fullName: data.fullName,
            setlistIds: [],
            groupIds: [],
          });
          if (!ignore) {
            dispatch(fetchOwnership(createdOwnership));
          }
        } else {
          dispatch(fetchOwnership(ownershipData));
        }
      } catch (err: unknown) {
        if (ignore) {
          return;
        }
        logRequestError('Session verification failed', err);
        if (isAxiosError(err) && err.response?.data?.raw === 'token-expired') {
          await persistor.purge();
          dispatch(signout());
        }
      } finally {
        if (!ignore) {
          setSession({ token, user: verifiedUser });
        }
      }
    };
    verifySession();
    return () => {
      ignore = true;
    };
  }, [dispatch, hasToken, token]);

  const isVerified = hasToken && session?.token === token;
  return {
    token,
    user: isVerified ? session?.user : undefined,
    loading: hasToken && !isVerified,
  };
};

export const useSongs = (id?: string) => {
  const dispatch = useDispatch();
  useEffect(() => {
    const fetchAllSongs = async () => {
      try {
        const { data, status } = await axios.get<SongSchema[]>('/api/songs/get');
        if (status === 200) {
          dispatch(fetchSongs(data));
        }
      } catch (e) {
        logRequestError('Error fetching songs:', e);
      }
    };
    fetchAllSongs();
  }, [dispatch]);

  const allSongs = useAppSelector((state) => state.songs);
  if (id) {
    const song = allSongs.find((song) => song._id === id);
    return song;
  }
  return allSongs;
};

export const useOwnership = () => {
  const ownership = useAppSelector((state) => state.ownership);
  return ownership;
};

export const useOwnedSetlists = () => {
  const ownership = useOwnership();
  const [setlists, setSetlists] = useState<Setlist[]>([]);

  useEffect(() => {
    const fetchSetlists = async () => {
      const setlistIds = ownership?.setlistIds ?? [];
      if (setlistIds.length > 0) {
        try {
          const setlistRes = await axios.get<Setlist[]>('/api/setlists/get');
          if (setlistRes.status === 200) {
            const filteredSetlists = setlistRes.data.filter((setlist) =>
              setlistIds.some((setlistOwnership) => setlistOwnership.id === setlist._id)
            );
            setSetlists(filteredSetlists);
          }
        } catch (error) {
          logRequestError('Error fetching setlists:', error);
        }
      }
    };

    fetchSetlists();
  }, [ownership]);

  return setlists;
};
