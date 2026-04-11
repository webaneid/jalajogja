import postgres from "postgres";

// Singleton postgres connection pool — di-share oleh public dan tenant client
// Satu pool untuk semua koneksi, efisien di VPS dengan resource terbatas
export const postgresClient = postgres(process.env.DATABASE_URL!);
