
export {};

declare global {
    interface Window {
        packForge: {
            selectFolder(): Promise<string | null>;

            saveArchive(
                format: "zip" | "tar" | "tar.gz"
            ): Promise<string | null>;

            openArchive(): Promise<string | null>;

            selectExtractFolder(): Promise<string | null>;

            listArchive(archivePath: string): Promise<{
                path: string;
                directory: boolean;
            }[]>;

            extractArchive(
                archivePath: string,
                destination: string
            ): Promise<{ success: boolean }>;

            createArchive(
                source: string,
                destination: string,
                format: "zip" | "tar" | "tar.gz"
            ): Promise<{ success: boolean }>;

            onProgress(callback: (progress: {
                processed: number;
                total: number;
                percent: number;
            }) => void): () => void;
        };
    }
}
