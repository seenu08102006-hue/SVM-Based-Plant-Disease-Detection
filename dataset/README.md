# Dataset

This project uses the **PlantVillage** dataset: https://github.com/spMohanty/PlantVillage-Dataset

The training script looks for the images in this order:

1. `--dataset PATH` argument
2. `plant-disease-ai/dataset/` (this folder: clone the repo *into* it so that `dataset/raw/color/` exists)
3. `../PlantVillage-Dataset/` (a sibling folder next to `plant-disease-ai/`)

```bash
# option 2: put the images here
git clone --depth 1 https://github.com/spMohanty/PlantVillage-Dataset.git dataset_tmp
# then move dataset_tmp/raw into plant-disease-ai/dataset/raw
```

Only `raw/color/<Class>/*.jpg` is used. Classes are discovered from those folder names (38 today).

`splits/` holds the official **leaf-grouped** 80/20 train/test lists, downloaded automatically from
https://huggingface.co/datasets/mohanty/PlantVillage on the first training run. Several photos of the
same physical leaf exist, so grouping by leaf stops near-duplicate images from leaking between train and test.
