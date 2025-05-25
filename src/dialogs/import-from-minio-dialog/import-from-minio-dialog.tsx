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
import { S3Client, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { useDebounce } from '@/hooks/use-debounce';

export interface ImportFromMinioDialogProps extends BaseDialogProps {}

interface MinioFile {
    key: string;
    lastModified: Date;
    size: number;
}

export const ImportFromMinioDialog: React.FC<ImportFromMinioDialogProps> = ({
    dialog,
}) => {
    const { t } = useTranslation();
    const { closeImportFromMinioDialog } = useDialog();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(false);
    const [files, setFiles] = useState<MinioFile[]>([]);
    const [selectedFileKey, setSelectedFileKey] = useState<
        string | undefined
    >();

    const loadFiles = useCallback(async () => {
        setIsLoading(true);
        setError(false);

        try {
            // Создаем клиент S3 для работы с MinIO
            const s3Client = new S3Client({
                region: 'us-east-1', // MinIO не использует регионы, но требуется указать
                endpoint: `${import.meta.env.VITE_MINIO_USE_SSL === 'true' ? 'https://' : 'http://'}${import.meta.env.VITE_MINIO_ENDPOINT}`,
                credentials: {
                    accessKeyId: import.meta.env.VITE_MINIO_ACCESS_KEY,
                    secretAccessKey: import.meta.env.VITE_MINIO_SECRET_KEY,
                },
                forcePathStyle: true, // Необходимо для MinIO
            });

            const bucketName = import.meta.env.VITE_MINIO_BUCKET_NAME;

            // Получаем список объектов в бакете
            const listCommand = new ListObjectsV2Command({
                Bucket: bucketName,
            });

            const response = await s3Client.send(listCommand);

            if (response.Contents) {
                // Преобразуем список объектов в формат для отображения
                const minioFiles = response.Contents.filter(
                    (item) => item.Key && item.LastModified && item.Size
                ) // Убеждаемся, что все поля есть
                    .filter((item) => item.Key!.endsWith('.json')) // Фильтруем только JSON файлы
                    .map((item) => ({
                        key: item.Key!,
                        lastModified: item.LastModified!,
                        size: item.Size!,
                    }))
                    .sort(
                        (a, b) =>
                            b.lastModified.getTime() - a.lastModified.getTime()
                    ); // Сортируем по дате модификации

                setFiles(minioFiles);
            }
        } catch (e) {
            console.error('Ошибка при загрузке файлов из MinIO:', e);
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

    // Функция для форматирования размера файла
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    // Функция для получения имени файла из ключа
    const getFileName = (key: string): string => {
        const parts = key.split('/');
        return parts[parts.length - 1];
    };

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
                    ) : files.length === 0 ? (
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
                                                        // Двойной клик - пока ничего не делаем
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
                        <Button type="submit" disabled={!selectedFileKey}>
                            {t('import_from_minio_dialog.import')}
                        </Button>
                    </DialogClose>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
