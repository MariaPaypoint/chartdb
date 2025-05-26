import React, { useCallback, useEffect, useState } from 'react';
import { useDialog } from '@/hooks/use-dialog';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogInternalContent,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Button } from '@/components/button/button';
import type { BaseDialogProps } from '../common/base-dialog-props';
import { useTranslation } from 'react-i18next';
import { Spinner } from '@/components/spinner/spinner';
import { AlertCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/alert/alert';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/table/table';
import {
    S3Client,
    ListObjectsV2Command,
    GetObjectCommand,
} from '@aws-sdk/client-s3';
import { useDebounce } from '@/hooks/use-debounce';
import { diagramFromJSONInput } from '@/lib/export-import-utils';
import { useStorage } from '@/hooks/use-storage';
import { useNavigate } from 'react-router-dom';

export interface ImportFromMinioDialogProps extends BaseDialogProps {}

interface MinioFile {
    key: string;
    lastModified: Date;
    size: number;
}

export const ImportFromMinioDialog: React.FC<ImportFromMinioDialogProps> = ({
    dialog,
}: ImportFromMinioDialogProps) => {
    const { t } = useTranslation();
    const { closeImportFromMinioDialog, closeCreateDiagramDialog } =
        useDialog();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);
    const [importError, setImportError] = useState(false);
    const [files, setFiles] = useState<MinioFile[]>([]);
    const [selectedFileKey, setSelectedFileKey] = useState<
        string | undefined
    >();
    const { addDiagram } = useStorage();
    const navigate = useNavigate();

    const loadFiles = useCallback(async () => {
        setIsLoading(true);
        setError(false);

        try {
            // Create S3 client for working with MinIO
            const s3Client = new S3Client({
                region: 'us-east-1', // MinIO doesn't use regions, but it's required to specify
                endpoint: `${import.meta.env.VITE_MINIO_USE_SSL === 'true' ? 'https://' : 'http://'}${import.meta.env.VITE_MINIO_ENDPOINT}`,
                credentials: {
                    accessKeyId: import.meta.env.VITE_MINIO_ACCESS_KEY,
                    secretAccessKey: import.meta.env.VITE_MINIO_SECRET_KEY,
                },
                forcePathStyle: true, // Required for MinIO
            });

            const bucketName = import.meta.env.VITE_MINIO_BUCKET_NAME;

            // Get the list of objects in the bucket
            const listCommand = new ListObjectsV2Command({
                Bucket: bucketName,
            });

            const response = await s3Client.send(listCommand);

            if (response.Contents) {
                // Convert the list of objects to display format
                const minioFiles = response.Contents.filter(
                    (item) => item.Key && item.LastModified && item.Size
                ) // Make sure all fields are present
                    .filter((item) => item.Key!.endsWith('.json')) // Filter only JSON files
                    .map((item) => ({
                        key: item.Key!,
                        lastModified: item.LastModified!,
                        size: item.Size!,
                    }))
                    .sort(
                        (a, b) =>
                            b.lastModified.getTime() - a.lastModified.getTime()
                    ); // Sort by modification date

                setFiles(minioFiles);
            }
        } catch (e) {
            console.error('Error loading files from MinIO:', e);
            setError(true);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!dialog.open) return;
        setError(false);
        setFiles([]);
        setSelectedFileKey(undefined);
        loadFiles();
    }, [dialog.open, loadFiles]);

    const handleRowKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTableRowElement>) => {
            const element = e.target as HTMLElement;
            const fileKey = element.getAttribute('data-file-key');
            const selectionIndexAttr = element.getAttribute(
                'data-selection-index'
            );

            if (!fileKey || !selectionIndexAttr) return;

            const selectionIndex = parseInt(selectionIndexAttr, 10);

            switch (e.key) {
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    setSelectedFileKey(fileKey);
                    break;
                case 'ArrowDown': {
                    e.preventDefault();

                    (
                        document.querySelector(
                            `[data-selection-index="${selectionIndex + 1}"]`
                        ) as HTMLElement
                    )?.focus();
                    break;
                }
                case 'ArrowUp': {
                    e.preventDefault();

                    (
                        document.querySelector(
                            `[data-selection-index="${selectionIndex - 1}"]`
                        ) as HTMLElement
                    )?.focus();
                    break;
                }
            }
        },
        []
    );

    const onFocusHandler = useDebounce(
        (fileKey: string) => setSelectedFileKey(fileKey),
        50
    );

    // Function to format file size
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    // Function to get file name from key
    const getFileName = (key: string): string => {
        const parts = key.split('/');
        return parts[parts.length - 1];
    };

    const handleImport = useCallback(async () => {
        if (!selectedFileKey) return;

        try {
            setIsLoading(true);
            setImportError(false);

            // Create S3 client for working with MinIO
            const s3Client = new S3Client({
                region: 'us-east-1',
                endpoint: `${import.meta.env.VITE_MINIO_USE_SSL === 'true' ? 'https://' : 'http://'}${import.meta.env.VITE_MINIO_ENDPOINT}`,
                credentials: {
                    accessKeyId: import.meta.env.VITE_MINIO_ACCESS_KEY,
                    secretAccessKey: import.meta.env.VITE_MINIO_SECRET_KEY,
                },
                forcePathStyle: true,
            });

            const bucketName = import.meta.env.VITE_MINIO_BUCKET_NAME;

            // Get object from MinIO
            const getCommand = new GetObjectCommand({
                Bucket: bucketName,
                Key: selectedFileKey,
            });

            const response = await s3Client.send(getCommand);

            if (!response.Body) {
                throw new Error('Failed to get file content');
            }

            // Read data from stream
            const jsonData = await response.Body.transformToString();

            // Convert JSON to diagram object
            const diagram = diagramFromJSONInput(jsonData);

            // Add diagram to storage
            await addDiagram({ diagram });

            // Close dialogs and navigate to diagram page
            closeImportFromMinioDialog();
            closeCreateDiagramDialog();
            navigate(`/diagrams/${diagram.id}`);
        } catch (e) {
            console.error('Error importing diagram from MinIO:', e);
            setImportError(true);
        } finally {
            setIsLoading(false);
        }
    }, [
        selectedFileKey,
        addDiagram,
        navigate,
        closeImportFromMinioDialog,
        closeCreateDiagramDialog,
    ]);

    return (
        <Dialog
            {...dialog}
            onOpenChange={(open) => {
                if (!open) {
                    closeImportFromMinioDialog();
                }
            }}
        >
            <DialogContent
                className="flex h-[30rem] max-h-screen flex-col overflow-y-auto md:min-w-[80vw] xl:min-w-[55vw]"
                showClose
            >
                <DialogHeader>
                    <DialogTitle>
                        {t('import_from_minio_dialog.title')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('import_from_minio_dialog.description')}
                    </DialogDescription>
                </DialogHeader>

                <DialogInternalContent>
                    {isLoading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Spinner className="size-10 text-primary" />
                        </div>
                    ) : error ? (
                        <Alert variant="destructive">
                            <AlertCircle className="size-4" />
                            <AlertTitle>
                                {t('import_from_minio_dialog.error.title')}
                            </AlertTitle>
                            <AlertDescription>
                                {t(
                                    'import_from_minio_dialog.error.description'
                                )}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {importError ? (
                        <Alert variant="destructive">
                            <AlertCircle className="size-4" />
                            <AlertTitle>
                                {t('import_diagram_dialog.error.title')}
                            </AlertTitle>
                            <AlertDescription>
                                {t('import_diagram_dialog.error.description')}
                            </AlertDescription>
                        </Alert>
                    ) : null}

                    {files.length === 0 ? (
                        <div className="flex h-40 items-center justify-center text-muted-foreground">
                            {t('import_from_minio_dialog.no_files')}
                        </div>
                    ) : (
                        <div className="flex flex-1 items-center justify-center">
                            <Table>
                                <TableHeader className="sticky top-0 bg-background">
                                    <TableRow>
                                        <TableHead>
                                            {t(
                                                'import_from_minio_dialog.table_columns.name'
                                            )}
                                        </TableHead>
                                        <TableHead>
                                            {t(
                                                'import_from_minio_dialog.table_columns.last_modified'
                                            )}
                                        </TableHead>
                                        <TableHead className="text-center">
                                            {t(
                                                'import_from_minio_dialog.table_columns.size'
                                            )}
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {files.map((file, index) => (
                                        <TableRow
                                            key={file.key}
                                            data-state={`${selectedFileKey === file.key ? 'selected' : ''}`}
                                            data-file-key={file.key}
                                            data-selection-index={index}
                                            tabIndex={0}
                                            onFocus={() =>
                                                onFocusHandler(file.key)
                                            }
                                            className="focus:bg-accent focus:outline-none"
                                            onClick={(e) => {
                                                switch (e.detail) {
                                                    case 1:
                                                        setSelectedFileKey(
                                                            file.key
                                                        );
                                                        break;
                                                    case 2:
                                                        // Double click - do nothing for now
                                                        break;
                                                    default:
                                                        setSelectedFileKey(
                                                            file.key
                                                        );
                                                }
                                            }}
                                            onKeyDown={handleRowKeyDown}
                                        >
                                            <TableCell>
                                                {getFileName(file.key)}
                                            </TableCell>
                                            <TableCell>
                                                {file.lastModified.toLocaleString()}
                                            </TableCell>
                                            <TableCell className="text-center">
                                                {formatFileSize(file.size)}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </DialogInternalContent>

                <DialogFooter className="flex !justify-between gap-2">
                    <DialogClose asChild>
                        <Button type="button" variant="secondary">
                            {t('import_from_minio_dialog.cancel')}
                        </Button>
                    </DialogClose>
                    <DialogClose asChild>
                        <Button
                            type="submit"
                            disabled={!selectedFileKey}
                            onClick={handleImport}
                        >
                            {t('import_from_minio_dialog.import')}
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
