import { connect } from 'mongoose';

export const connectToDB = async (): Promise<void> => {
  const params = new URLSearchParams({
    ssl: 'true',
    replicaSet: process.env.MONGO_REPLICA_SET ?? '',
    authSource: process.env.MONGO_AUTH_SOURCE ?? '',
  });

  await connect(
    `mongodb://${process.env.MONGO_USERNAME}:${process.env.MONGO_PASSWORD}@${process.env.MONGO_URI}/${process.env.MONGO_DB}?${params}`
  );
  console.log('Mongoose: Successfully connected to MongoDB');
};
