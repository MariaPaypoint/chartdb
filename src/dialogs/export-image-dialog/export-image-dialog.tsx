import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDialog } from '@/hooks/use-dialog';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/dialog/dialog';
import { Button } from '@/components/button/button';
import type { SelectBoxOption } from '@/components/select-box/select-box';
import { SelectBox } from '@/components/select-box/select-box';
import type { BaseDialogProps } from '../common/base-dialog-props';
import { useTranslation } from 'react-i18next';
import type { ImageType } from '@/context/export-image-context/export-image-context';
import { useExportImage } from '@/hooks/use-export-image';
import { autoCropImage } from '@/utils/image-utils';
import { Checkbox } from '@/components/checkbox/checkbox';
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from '@/components/accordion/accordion';

export interface ExportImageDialogProps extends BaseDialogProps {
    format: ImageType;
}

const DEFAULT_INCLUDE_PATTERN_BG = true;
const DEFAULT_TRANSPARENT = false;
const DEFAULT_AUTO_CROP = true;
const DEFAULT_SCALE = '2';
export const ExportImageDialog: React.FC<ExportImageDialogProps> = ({
    dialog,
    format,
}) => {
    const { t } = useTranslation();
    const [scale, setScale] = useState<string>(DEFAULT_SCALE);
    const [includePatternBG, setIncludePatternBG] = useState<boolean>(
        DEFAULT_INCLUDE_PATTERN_BG
    );
    const [transparent, setTransparent] =
        useState<boolean>(DEFAULT_TRANSPARENT);
    const [autoCrop, setAutoCrop] = useState<boolean>(DEFAULT_AUTO_CROP);
    const { exportImage } = useExportImage();

    useEffect(() => {
        if (!dialog.open) return;
        setScale(DEFAULT_SCALE);
        setIncludePatternBG(DEFAULT_INCLUDE_PATTERN_BG);
        setTransparent(DEFAULT_TRANSPARENT);
        setAutoCrop(DEFAULT_AUTO_CROP);
    }, [dialog.open]);

    // Выключаем опцию обрезки, если включен фоновый паттерн
    useEffect(() => {
        if (includePatternBG && autoCrop) {
            setAutoCrop(false);
        }
    }, [includePatternBG, autoCrop]);
    const { closeExportImageDialog } = useDialog();

    const handleExport = useCallback(async () => {
        try {
            console.log(
                `[export-dialog] Экспорт диаграммы в формате: ${format}`
            );

            // Отдельная обработка для формата SVG
            if (format === 'svg') {
                console.log(
                    '[export-dialog] Используем метод загрузки через fetch для SVG'
                );

                try {
                    // Получаем SVG данные
                    const imageUrl = await exportImage('svg', {
                        transparent,
                        includePatternBG,
                        scale: Number(scale),
                    });

                    console.log(
                        '[export-dialog] Получен SVG URL, длина:',
                        imageUrl.length
                    );

                    // Используем fetch для получения данных SVG
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();

                    console.log(
                        '[export-dialog] Создан blob для SVG, размер:',
                        blob.size
                    );

                    // Создаем файл и начинаем загрузку
                    const url = window.URL.createObjectURL(blob);
                    const filename = 'diagram.svg';

                    // Создаем новый элемент ссылки для загрузки
                    const downloadLink = document.createElement('a');
                    downloadLink.href = url;
                    downloadLink.download = filename;
                    downloadLink.style.display = 'none';

                    // Добавляем в DOM, кликаем и удаляем
                    document.body.appendChild(downloadLink);
                    console.log('[export-dialog] Начинаем загрузку SVG файла');
                    downloadLink.click();

                    // Даем время на скачивание перед удалением
                    await new Promise((resolve) => setTimeout(resolve, 300));

                    document.body.removeChild(downloadLink);
                    window.URL.revokeObjectURL(url);
                    console.log('[export-dialog] Загрузка SVG завершена');

                    return true;
                } catch (error) {
                    console.error('Ошибка при экспорте SVG:', error);
                    throw error;
                }
            } else {
                // Для PNG и JPEG применяем стандартный метод экспорта
                console.log(
                    `[export-dialog] Экспорт ${format} с параметрами: масштаб=${scale}, прозрачность=${transparent}`
                );

                // Получаем изображение
                const imageUrl = await exportImage(format, {
                    transparent,
                    includePatternBG,
                    scale: Number(scale),
                });

                // Применяем автоматическую обрезку, если нужно
                let finalImageUrl;

                if (autoCrop && !includePatternBG) {
                    console.log(
                        '[export-dialog] Применяем автоматическую обрезку'
                    );
                    finalImageUrl = await autoCropImage(imageUrl, 50, format);
                } else {
                    finalImageUrl = imageUrl;
                }

                // Создаем ссылку для скачивания
                const link = document.createElement('a');
                link.download = `diagram.${format}`;
                link.href = finalImageUrl;
                document.body.appendChild(link);
                console.log(`[export-dialog] Запуск скачивания ${format}`);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error) {
            console.error('Ошибка при экспорте изображения:', error);
        }
    }, [exportImage, format, includePatternBG, transparent, scale, autoCrop]);

    const scaleOptions: SelectBoxOption[] = useMemo(
        () =>
            ['1', '2', '3', '4'].map((scale) => ({
                value: scale,
                label: t(`export_image_dialog.scale_${scale}x`),
            })),
        [t]
    );

    return (
        <Dialog
            {...dialog}
            onOpenChange={(open) => {
                if (!open) {
                    closeExportImageDialog();
                }
            }}
        >
            <DialogContent className="flex flex-col" showClose>
                <DialogHeader>
                    <DialogTitle>{t('export_image_dialog.title')}</DialogTitle>
                    <DialogDescription>
                        {t('export_image_dialog.description')}
                    </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4 py-1">
                    <SelectBox
                        options={scaleOptions}
                        multiple={false}
                        value={scale}
                        onChange={(value) => setScale(value as string)}
                    />
                    <Accordion type="single" collapsible className="w-full">
                        <AccordionItem value="settings" className="border-0">
                            <AccordionTrigger
                                className="py-1.5"
                                iconPosition="right"
                            >
                                {t('export_image_dialog.advanced_options')}
                            </AccordionTrigger>
                            <AccordionContent>
                                <div className="flex flex-col gap-3 py-2">
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id="pattern-checkbox"
                                            className="mt-1 data-[state=checked]:border-pink-600 data-[state=checked]:bg-pink-600 data-[state=checked]:text-white"
                                            checked={includePatternBG}
                                            onCheckedChange={(value) =>
                                                setIncludePatternBG(
                                                    value as boolean
                                                )
                                            }
                                        />
                                        <div className="flex flex-col">
                                            <label
                                                htmlFor="pattern-checkbox"
                                                className="cursor-pointer font-medium"
                                            >
                                                {t(
                                                    'export_image_dialog.pattern'
                                                )}
                                            </label>
                                            <span className="text-sm text-muted-foreground">
                                                {t(
                                                    'export_image_dialog.pattern_description'
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id="transparent-checkbox"
                                            className="mt-1 data-[state=checked]:border-pink-600 data-[state=checked]:bg-pink-600 data-[state=checked]:text-white"
                                            checked={transparent}
                                            onCheckedChange={(value) =>
                                                setTransparent(value as boolean)
                                            }
                                        />
                                        <div className="flex flex-col">
                                            <label
                                                htmlFor="transparent-checkbox"
                                                className="cursor-pointer font-medium"
                                            >
                                                {t(
                                                    'export_image_dialog.transparent'
                                                )}
                                            </label>
                                            <span className="text-sm text-muted-foreground">
                                                {t(
                                                    'export_image_dialog.transparent_description'
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id="auto-crop-checkbox"
                                            className="mt-1 data-[state=checked]:border-pink-600 data-[state=checked]:bg-pink-600 data-[state=checked]:text-white"
                                            checked={autoCrop}
                                            disabled={includePatternBG}
                                            onCheckedChange={(value) =>
                                                setAutoCrop(value as boolean)
                                            }
                                        />
                                        <div className="flex flex-col">
                                            <label
                                                htmlFor="auto-crop-checkbox"
                                                className={`cursor-pointer font-medium ${includePatternBG ? 'text-muted-foreground' : ''}`}
                                            >
                                                Обрезать пустые поля
                                            </label>
                                            <span className="text-sm text-muted-foreground">
                                                Автоматически обрезать пустые
                                                поля вокруг диаграммы
                                                {includePatternBG && (
                                                    <span className="mt-1 block text-xs italic">
                                                        (Недоступно при
                                                        включенном фоновом
                                                        паттерне)
                                                    </span>
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                    </Accordion>
                </div>
                <DialogFooter className="flex gap-1 md:justify-between">
                    <DialogClose asChild>
                        <Button variant="secondary">
                            {t('export_image_dialog.cancel')}
                        </Button>
                    </DialogClose>
                    <Button
                        onClick={async () => {
                            console.log(
                                `[export-button] Нажата кнопка экспорта, формат: ${format}`
                            );
                            try {
                                await handleExport();
                                console.log(
                                    '[export-button] Экспорт успешно завершен'
                                );
                                // Закрываем диалог только после завершения экспорта
                                closeExportImageDialog();
                            } catch (error) {
                                console.error(
                                    '[export-button] Ошибка при экспорте:',
                                    error
                                );
                            }
                        }}
                    >
                        {t('export_image_dialog.export')}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
