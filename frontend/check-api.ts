import { ImageCropper } from '@ark-ui/solid'; type Api = ReturnType<Parameters<typeof ImageCropper.Context>[0]['children']>; const x: keyof Api = 'wrong';
