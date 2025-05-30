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

    // Disable cropping option if background pattern is enabled
    useEffect(() => {
        if (includePatternBG && autoCrop) {
            setAutoCrop(false);
        }
    }, [includePatternBG, autoCrop]);
    const { closeExportImageDialog } = useDialog();

    const handleExport = useCallback(async () => {
        try {
            console.log(
                `[export-dialog] Exporting diagram in format: ${format}`
            );

            // Separate processing for SVG format
            if (format === 'svg') {
                console.log(
                    '[export-dialog] Using fetch method for SVG download'
                );

                try {
                    // Get SVG data
                    const imageUrl = await exportImage('svg', {
                        transparent,
                        includePatternBG,
                        scale: Number(scale),
                    });

                    console.log(
                        '[export-dialog] Received SVG URL, length:',
                        imageUrl.length
                    );

                    // Use fetch to get SVG data
                    const response = await fetch(imageUrl);
                    const blob = await response.blob();

                    console.log(
                        '[export-dialog] Created blob for SVG, size:',
                        blob.size
                    );

                    // Create file and start download
                    const url = window.URL.createObjectURL(blob);
                    const filename = 'diagram.svg';

                    // Create download link element
                    const downloadLink = document.createElement('a');
                    downloadLink.href = url;
                    downloadLink.download = filename;
                    downloadLink.style.display = 'none';

                    // Add to DOM, click and remove
                    document.body.appendChild(downloadLink);
                    console.log('[export-dialog] Starting SVG file download');
                    downloadLink.click();

                    // Allow time for download before removal
                    await new Promise((resolve) => setTimeout(resolve, 300));

                    document.body.removeChild(downloadLink);
                    window.URL.revokeObjectURL(url);
                    console.log('[export-dialog] SVG download completed');

                    return true;
                } catch (error) {
                    console.error('Error exporting SVG:', error);
                    throw error;
                }
            } else {
                // For PNG and JPEG use standard export method
                console.log(
                    `[export-dialog] Exporting ${format} with parameters: scale=${scale}, transparency=${transparent}`
                );

                // Get the image
                const imageUrl = await exportImage(format, {
                    transparent,
                    includePatternBG,
                    scale: Number(scale),
                });

                // Apply automatic cropping if needed
                let finalImageUrl;

                if (autoCrop && !includePatternBG) {
                    console.log('[export-dialog] Applying automatic cropping');
                    finalImageUrl = await autoCropImage(imageUrl, 50, format);
                } else {
                    finalImageUrl = imageUrl;
                }

                // Create download link
                const link = document.createElement('a');
                link.download = `diagram.${format}`;
                link.href = finalImageUrl;
                document.body.appendChild(link);
                console.log(`[export-dialog] Starting ${format} download`);
                link.click();
                document.body.removeChild(link);
            }
        } catch (error) {
            console.error('Error exporting image:', error);
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
                                                {t(
                                                    'export_image_dialog.crop_empty_space'
                                                )}
                                            </label>
                                            <span className="text-sm text-muted-foreground">
                                                {t(
                                                    'export_image_dialog.crop_description'
                                                )}
                                                {includePatternBG && (
                                                    <span className="mt-1 block text-xs italic">
                                                        {t(
                                                            'export_image_dialog.crop_unavailable'
                                                        )}
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
                                `[export-button] Export button pressed, format: ${format}`
                            );
                            try {
                                await handleExport();
                                console.log(
                                    '[export-button] Export completed successfully'
                                );
                                // Close dialog only after export is complete
                                closeExportImageDialog();
                            } catch (error) {
                                console.error(
                                    '[export-button] Error during export:',
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
