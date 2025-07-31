import { DatabaseStorage } from "./database-storage";

// Export the database storage implementation  
export const storage = new DatabaseStorage();

// Re-export the interface for type safety
export type { IStorage } from "./storage-interface";