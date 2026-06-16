#!/usr/bin/env python3
"""RAG Indexer - Index product knowledge base documents"""
import json, os, hashlib, glob
from datetime import datetime

PROJECT_ROOT = "/Users/jmpark/Documents/Playground/sangfor-mcp-workflow"
INDEX_PATH = os.path.join(PROJECT_ROOT, "data/rag/index.json")
PRODUCTS_DIR = os.path.join(PROJECT_ROOT, "products")

def chunk_text(text, chunk_size=500, overlap=50):
    lines = text.split('\n')
    chunks = []
    for i in range(0, len(lines), chunk_size - overlap):
        chunk = '\n'.join(lines[i:i+chunk_size])
        if chunk.strip():
            chunks.append(chunk)
    return chunks

def index_product_files():
    results = {"total_lines": 0, "indexed": 0, "failed": 0, "products": {}, "errors": []}
    index_data = {}
    
    for product_dir in glob.glob(os.path.join(PRODUCTS_DIR, "*")):
        if not os.path.isdir(product_dir):
            continue
        product_name = os.path.basename(product_dir)
        product_count = 0
        
        for subdir in ["outputs", "wiki"]:
            dir_path = os.path.join(product_dir, subdir)
            if not os.path.isdir(dir_path):
                continue
            for md_file in glob.glob(os.path.join(dir_path, "*.md")):
                try:
                    with open(md_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                    lines = content.split('\n')
                    results["total_lines"] += len(lines)
                    
                    chunks = chunk_text(content)
                    for i, chunk in enumerate(chunks):
                        chunk_id = hashlib.md5(f"{md_file}:{i}".encode()).hexdigest()[:12]
                        entry = {
                            "id": chunk_id,
                            "product_name": product_name,
                            "namespace": f"kb/products/{product_name}",
                            "source_file": os.path.basename(md_file),
                            "source_path": md_file,
                            "section": subdir,
                            "content_type": "wiki" if subdir == "wiki" else "output",
                            "evidence_type": "sangfor_official" if "확인 필요" not in chunk[:200] else "needs_verification",
                            "confidence": "high" if "Manual" in chunk or "White Paper" in chunk else "medium",
                            "indexed_at": datetime.now().isoformat(),
                            "chunk_index": i,
                            "chunk_text": chunk[:200]
                        }
                        index_data[chunk_id] = entry
                        product_count += 1
                    
                    results["indexed"] += 1
                except Exception as e:
                    results["failed"] += 1
                    results["errors"].append(f"{md_file}: {str(e)}")
        
        results["products"][product_name] = {"files": product_count, "namespace": f"kb/products/{product_name}"}
    
    # Also index extracted text files in /tmp
    for txt_file in glob.glob("/tmp/*_manual.txt") + glob.glob("/tmp/*_wp.txt"):
        try:
            with open(txt_file, 'r', encoding='utf-8') as f:
                content = f.read()
            lines = content.split('\n')
            results["total_lines"] += len(lines)
            
            product_map = {
                "iag_manual": "iag", "ske_wp": "ske", 
                "hdr_manual": "hdr", "vdi_manual": "vdi"
            }
            basename = os.path.basename(txt_file).replace('.txt', '')
            product_name = product_map.get(basename, "unclassified")
            
            chunks = chunk_text(content, chunk_size=1000, overlap=100)
            for i, chunk in enumerate(chunks):
                chunk_id = hashlib.md5(f"{txt_file}:{i}".encode()).hexdigest()[:12]
                entry = {
                    "id": chunk_id,
                    "product_name": product_name,
                    "namespace": f"kb/products/{product_name}",
                    "source_file": os.path.basename(txt_file),
                    "source_path": txt_file,
                    "section": "extracted_text",
                    "content_type": "source_text",
                    "evidence_type": "sangfor_official",
                    "confidence": "high",
                    "indexed_at": datetime.now().isoformat(),
                    "chunk_index": i,
                    "chunk_text": chunk[:200]
                }
                index_data[chunk_id] = entry
                if product_name in results["products"]:
                    results["products"][product_name]["source_chunks"] = results["products"][product_name].get("source_chunks", 0) + 1
                else:
                    results["products"][product_name] = {"source_chunks": 1, "namespace": f"kb/products/{product_name}"}
            
            results["indexed"] += 1
        except Exception as e:
            results["failed"] += 1
            results["errors"].append(f"{txt_file}: {str(e)}")
    
    # Save index
    os.makedirs(os.path.dirname(INDEX_PATH), exist_ok=True)
    with open(INDEX_PATH, 'w', encoding='utf-8') as f:
        json.dump(index_data, f, ensure_ascii=False, indent=2)
    
    results["total_chunks"] = len(index_data)
    return results

if __name__ == "__main__":
    results = index_product_files()
    print(json.dumps(results, ensure_ascii=False, indent=2))
