# Size: 440MB
import os
import shutil
from huggingface_hub import snapshot_download, hf_hub_download, scan_cache_dir
from tqdm.auto import tqdm 
from sentence_transformers import SentenceTransformer

MODEL_ID = "sentence-transformers/all-mpnet-base-v2"
DESTINATION_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "local_mpnet_model")

MAIN_FILES = [
    "modules.json",
    "config_sentence_transformers.json",
    "README.md",
    "sentence_bert_config.json",
    "config.json",
    "model.safetensors", 
    "tokenizer_config.json",
    "vocab.txt",
    "tokenizer.json",
    "special_tokens_map.json"
]

SUB_FILES = [
    "1_Pooling/config.json" 
]
def step_1_clean_workspace():
    print(f"🧹 STEP 1: Cleaning Workspace...")
    
    # Delete Local Folder
    if os.path.exists(DESTINATION_FOLDER):
        print(f"   - Removing existing local folder: {DESTINATION_FOLDER}")
        shutil.rmtree(DESTINATION_FOLDER)
    
    try:
        hf_cache_info = scan_cache_dir()
        for repo in hf_cache_info.repos:
            if repo.repo_id == MODEL_ID:
                print(f"   - Found global cache. Clearing it to force fresh download...")
                delete_strategy = scan_cache_dir().delete_revisions(*repo.revisions)
                delete_strategy.execute()
    except Exception:
        pass

    print("    Clean slate established.\n")

def step_2_download_main_files():
    print(f" Downloading Main Model Files...")
    try:
        snapshot_download(
            repo_id=MODEL_ID,
            local_dir=DESTINATION_FOLDER,
            allow_patterns=MAIN_FILES,
            tqdm_class=tqdm,
            force_download=True
        )
        print(f"    Main files downloaded.")
    except Exception as e:
        print(f"\n CRITICAL FAILURE (Main Files): {e}")
        exit()

def step_3_download_missing_configs():
    print(f"\n Fetching Missing Configurations (Pooling)...")
    try:
        # Create the subfolder manually first
        pooling_path = os.path.join(DESTINATION_FOLDER, "1_Pooling")
        if not os.path.exists(pooling_path):
            os.makedirs(pooling_path)

        # Download specific file to that folder
        hf_hub_download(
            repo_id=MODEL_ID,
            filename="1_Pooling/config.json",
            local_dir=DESTINATION_FOLDER
        )
        print(f"    '1_Pooling/config.json' retrieved.")
    except Exception as e:
        print(f"\n CRITICAL FAILURE (Pooling Config): {e}")
        exit()

def step_4_verify_math():
    print(f"\n Verifying Math Integrity...")
    try:
        # Load from the folder we just built
        model = SentenceTransformer(DESTINATION_FOLDER)
        
        # Test Vector Generation
        test_text = "sad movie in space"
        vector = model.encode(test_text)
        
        print(f"   - Vector Shape: {vector.shape}")
        
        # Zero Check
        if max(vector) == 0 and min(vector) == 0:
            print("    FATAL: Model loaded but outputs ZEROS.")
            print("      This usually means 'pytorch_model.bin' or 'model.safetensors' is corrupt.")
        else:
            print(f"   - Sample Value: {vector[0]:.5f}")
            print("\n SUCCESS! The mpnet_model is fully installed and verified.")
            
    except Exception as e:
        print(f"    FATAL: Model failed to load: {e}")
if __name__ == "__main__":
    print("Downloading..........")

    
    step_1_clean_workspace()
    step_2_download_main_files()
    step_3_download_missing_configs()
    step_4_verify_math()
    