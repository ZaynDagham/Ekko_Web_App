import pandas as pd
import numpy as np
import json
import joblib
import os
#  NEW IMPORT
from sentence_transformers import SentenceTransformer

class EkkoBrain:
    def __init__(self):
        print(" Starting up EKKO...")
        
        # 1. Define Paths
        self.base_path = os.path.dirname(os.path.abspath(__file__))
        self.data_path = os.path.join(self.base_path, "data")
        self.models_path = os.path.join(self.data_path, "models")
        
        # 2. Initialize Storage
        self.metadata = None
        self.ai_embeddings = None
        self.tconst_map = {}
        self.tag_map = {}
        self.model = None          
        self.svd_factors = None    
        self.encoder = None #  NEW: The Text-to-Math Engine

        # 3. Load Everything
        self.load_core_data()
        self.load_models()
        self.load_vip_tags()
        self.load_encoder() #  NEW CALL

    def load_core_data(self):
        try:
            print("   Loading Embeddings (npy)...", end=" ")
            self.ai_embeddings = np.load(os.path.join(self.data_path, "ai_embeddings.npy"))
            print("Done")
            
            print("   Loading Metadata (parquet)...", end=" ")
            enriched_path = os.path.join(self.data_path, "metadata_enriched.parquet")
            search_path = os.path.join(self.data_path, "search_metadata.parquet")
            
            if os.path.exists(enriched_path):
                self.metadata = pd.read_parquet(enriched_path)
                print("(Using Enriched)", end=" ")
            elif os.path.exists(search_path):
                self.metadata = pd.read_parquet(search_path)
                print("(Using Search)", end=" ")
            else:
                tsv_path = os.path.join(self.data_path, "titles.tsv")
                self.metadata = pd.read_csv(tsv_path, sep='\t')
                print("(Using TSV)", end=" ")

            print("Done")

        except Exception as e:
            print(f" Error loading Core Data: {e}")

    def load_models(self):
        """Loads the ML Models from 'data/models'."""
        try:
            print("   Loading ID Map...", end=" ")
            map_path = os.path.join(self.models_path, "tconst_map.joblib")
            
            loaded_map = None
            if os.path.exists(map_path):
                loaded_map = joblib.load(map_path)
            
            if loaded_map and len(loaded_map) == len(self.metadata):
                self.tconst_map = loaded_map
                print("Done")
            else:
                print(f" Mismatch detected. Rebuilding...", end=" ")
                self.tconst_map = {tconst: i for i, tconst in enumerate(self.metadata['tconst'])}
                print("Done")

            print("   Loading LightGBM...", end=" ")
            lgbm_path = os.path.join(self.models_path, "lightgbm_model.joblib")
            if os.path.exists(lgbm_path):
                self.model = joblib.load(lgbm_path)
                print("Done")
            else:
                print(" Missing")

            svd_path = os.path.join(self.models_path, "svd_item_factors.npy")
            if os.path.exists(svd_path):
                self.svd_factors = np.load(svd_path).astype(np.float32)

        except Exception as e:
            print(f" Warning: Model loading issue ({e}).")

    def load_vip_tags(self):
        """Loads the Llama 3 Analysis JSON file."""
        tag_path = os.path.join(self.data_path, "vip_llama_ai_tags.json")
        try:
            with open(tag_path, "r") as f:
                raw_data = json.load(f)
            
            if isinstance(raw_data, list):
                self.tag_map = {}
                for item in raw_data:
                    key = item.get('tconst') or item.get('id')
                    val = item.get('tags') or item.get('analysis')
                    if key and val:
                        self.tag_map[key] = val
            else:
                self.tag_map = raw_data
                
            print(f"   VIP Knowledge Loaded: {len(self.tag_map)} movies indexed.")
        except Exception as e:
            print(f" Warning: VIP tags issue: {e}")
            self.tag_map = {}


    def load_encoder(self):
            print("   Loading Encoder...", end=" ")
            local_model_path = os.path.join(self.base_path, "local_mpnet_model") 
            
            if os.path.exists(local_model_path):
                self.encoder = SentenceTransformer(local_model_path)
                print(f" Loaded from CLEAN LOCAL SOURCE.")
            else:
                print(" Error: Local model missing.")

    def vectorize_text(self, text):
            """Turns a string into a (1, 768) vector."""
            if not self.encoder:
                print("    Encoder is None!")
                return None
            
            vec = self.encoder.encode(text)
            
            reshaped_vec = vec.reshape(1, -1)
            
            print(f"    Vector Shape: {reshaped_vec.shape}") 
            
            return reshaped_vec

ekko_brain = EkkoBrain()