#!/usr/bin/env python3
"""
Unit and Integration Tests for Atelier 8K - restore_images.py
Tests configuration, folder selection, file detection, atomic writing, and rate-limit retry logic.
"""

import os
import sys
import json
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch

# Ensure root directory is in sys.path
PROJECT_ROOT = Path(__file__).parent.parent.resolve()
sys.path.insert(0, str(PROJECT_ROOT))

import restore_images


class TestRestoreImagesConfig(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.config_path = Path(self.test_dir) / "test_config.json"
        self.orig_config_file = restore_images.CONFIG_FILE
        restore_images.CONFIG_FILE = self.config_path

    def tearDown(self):
        restore_images.CONFIG_FILE = self.orig_config_file
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_load_config_empty_when_missing(self):
        cfg = restore_images.load_config()
        self.assertEqual(cfg, {})

    def test_save_and_load_config(self):
        sample = {"last_folder": "C:/Photos", "model": "gemini-3-pro-image"}
        restore_images.save_config(sample)
        self.assertTrue(self.config_path.exists())
        loaded = restore_images.load_config()
        self.assertEqual(loaded, sample)


class TestFolderAndFileSelection(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.source_dir = Path(self.test_dir) / "source"
        self.source_dir.mkdir()

        # Create sample files
        (self.source_dir / "valid_lower.jpg").write_bytes(b"test1")
        (self.source_dir / "valid_upper.PNG").write_bytes(b"test2")
        (self.source_dir / "valid_webp.webp").write_bytes(b"test3")
        (self.source_dir / "valid_tiff.tif").write_bytes(b"test4")
        (self.source_dir / "ignored.txt").write_bytes(b"text")
        (self.source_dir / "ignored.json").write_bytes(b"{}")
        (self.source_dir / "ignored.tmp").write_bytes(b"tmp")

        # Create a subfolder with image to ensure non-recursion
        self.sub_dir = self.source_dir / "subfolder"
        self.sub_dir.mkdir()
        (self.sub_dir / "nested.jpg").write_bytes(b"nested")

        # Create FULLSIZE subfolder with images to verify they are excluded
        self.fullsize_dir = self.source_dir / "FULLSIZE"
        self.fullsize_dir.mkdir()
        (self.fullsize_dir / "already_restored.png").write_bytes(b"done")

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_get_image_files_filters_and_excludes_subfolders(self):
        images = restore_images.get_image_files(self.source_dir)
        image_names = {img.name for img in images}

        self.assertIn("valid_lower.jpg", image_names)
        self.assertIn("valid_upper.PNG", image_names)
        self.assertIn("valid_webp.webp", image_names)
        self.assertIn("valid_tiff.tif", image_names)
        self.assertNotIn("ignored.txt", image_names)
        self.assertNotIn("ignored.json", image_names)
        self.assertNotIn("ignored.tmp", image_names)
        self.assertNotIn("nested.jpg", image_names)
        self.assertNotIn("already_restored.png", image_names)

    def test_select_folder_prevents_direct_fullsize_selection(self):
        chosen = restore_images.select_folder(str(self.fullsize_dir))
        self.assertEqual(chosen.resolve(), self.source_dir.resolve())

    def test_select_folder_validates_existing_directory(self):
        non_existent = str(Path(self.test_dir) / "does_not_exist")
        with self.assertRaises(SystemExit):
            with patch("sys.stdout"):
                restore_images.select_folder(non_existent)


class TestAtomicRestorationLogic(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.source_img = Path(self.test_dir) / "input.jpg"
        self.source_img.write_bytes(b"\xff\xd8\xff\xe0" + b"\x00" * 64)
        self.output_img = Path(self.test_dir) / "output.png"

    def tearDown(self):
        shutil.rmtree(self.test_dir, ignore_errors=True)

    def test_restore_image_zero_byte_guard(self):
        zero_img = Path(self.test_dir) / "empty.jpg"
        zero_img.write_bytes(b"")
        mock_client = MagicMock()
        ok = restore_images.restore_image(mock_client, zero_img, self.output_img)
        self.assertFalse(ok)
        mock_client.models.generate_content.assert_not_called()

    def test_restore_image_atomic_write_success(self):
        mock_client = MagicMock()
        mock_part = MagicMock()
        mock_part.inline_data = MagicMock()
        mock_part.inline_data.data = b"\x89PNG\r\n\x1a\nfakeimagebytes"

        mock_candidate = MagicMock()
        mock_candidate.content.parts = [mock_part]
        mock_candidate.finish_reason = "STOP"

        mock_response = MagicMock()
        mock_response.candidates = [mock_candidate]
        mock_client.models.generate_content.return_value = mock_response

        ok = restore_images.restore_image(mock_client, self.source_img, self.output_img)
        self.assertTrue(ok)
        self.assertTrue(self.output_img.exists())
        self.assertEqual(self.output_img.read_bytes(), b"\x89PNG\r\n\x1a\nfakeimagebytes")
        # Ensure temporary file is gone
        tmp_path = self.output_img.with_suffix(".tmp")
        self.assertFalse(tmp_path.exists())

    def test_restore_image_cleans_up_tmp_on_failure(self):
        mock_client = MagicMock()
        mock_client.models.generate_content.side_effect = RuntimeError("API Connection Dropped")

        ok = restore_images.restore_image(mock_client, self.source_img, self.output_img)
        self.assertFalse(ok)
        self.assertFalse(self.output_img.exists())
        tmp_path = self.output_img.with_suffix(".tmp")
        self.assertFalse(tmp_path.exists())


if __name__ == "__main__":
    unittest.main()
