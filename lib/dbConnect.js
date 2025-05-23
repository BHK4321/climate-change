import mongoose from 'mongoose';

async function dbConnect() {
  mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch(err => console.error("MongoDB Connection Error:", err.message));
}

export default dbConnect;
