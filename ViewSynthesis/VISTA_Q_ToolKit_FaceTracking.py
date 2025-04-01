import os
import sys
import time
import csv
import random
import importlib.util
import cv2
import mediapipe as mp
import numpy as np
from PIL import Image
import pandas as pd
import argparse
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                            QHBoxLayout, QLabel, QPushButton, QFrame, QTableWidget, 
                            QTableWidgetItem, QMessageBox, QProgressBar)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QImage, QPixmap

class ModernButton(QPushButton):
    def __init__(self, text, parent=None):
        super().__init__(text, parent)
        self.setStyleSheet("""
            QPushButton {
                background-color: #4a90e2;
                color: white;
                border: none;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 14px;
            }
            QPushButton:hover {
                background-color: #357abd;
            }
            QPushButton:pressed {
                background-color: #2d6da3;
            }
        """)

class ModelVisualizerQTCamera(QMainWindow):
    def __init__(self, csv_file="./Test_Configs/ViewSynthesis_Test_Sequence.csv", train_mode=False, camera_fps=30, hide_tracking=False):
        super().__init__()
        self.csv_file = csv_file
        self.train_mode = train_mode
        self.camera_fps = camera_fps
        self.hide_tracking = hide_tracking
        self.test_id = None
        self.test_sequences = None
        self.current_sequence_idx = 0
        self.results = {}
        
        # Variables
        self.current_model = None
        self.timer_running = False
        self.start_time = 0
        self.presentation_time = 0
        
        # Rating labels
        self.rating_labels = {
            1: "Bad",
            2: "Poor",
            3: "Fair",
            4: "Good",
            5: "Excellent"
        }
        
        # Camera and face tracking variables
        self.cap = None
        self.face_mesh = None
        self.origin_x = None
        self.origin_y = None
        self.origin_z = None
        self.origin_known = False
        self.frame_duration = 1.0 / self.camera_fps
        
        # Initialize face tracking
        self.setup_face_tracking()
        
        # Set up the UI
        self.setup_ui()
        
        # Show test ID input first
        self.show_test_id_screen()
    
    def setup_face_tracking(self):
        """Initialize face tracking components"""
        # Initialize MediaPipe Face Detection
        mp_face_mesh = mp.solutions.face_mesh
        self.face_mesh = mp_face_mesh.FaceMesh(
            static_image_mode=False,
            max_num_faces=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5
        )
        
        # Initialize video capture
        self.cap = cv2.VideoCapture(0)
        if not self.cap.isOpened():
            QMessageBox.critical(self, "Error", "Could not open camera")
            sys.exit()
    
    def setup_ui(self):
        """Set up the modern user interface"""
        self.setWindowTitle("VISTA-Q: View Synthesis (Camera Control)")
        self.setStyleSheet("""
            QMainWindow {
                background-color: #000000;
            }
            QLabel {
                color: white;
                font-size: 14px;
            }
            QTableWidget {
                background-color: #3b3b3b;
                color: white;
                border: 1px solid #4a90e2;
                border-radius: 4px;
            }
            QTableWidget::item {
                padding: 5px;
            }
            QHeaderView::section {
                background-color: #4a90e2;
                color: white;
                padding: 5px;
                border: none;
            }
            QProgressBar {
                border: 1px solid #4a90e2;
                border-radius: 4px;
                text-align: center;
                background-color: #3b3b3b;
                color: white;
            }
            QProgressBar::chunk {
                background-color: #4a90e2;
                border-radius: 3px;
            }
        """)
        
        # Create central widget and main layout
        central_widget = QWidget()
        self.setCentralWidget(central_widget)
        self.main_layout = QVBoxLayout(central_widget)
        self.main_layout.setSpacing(20)
        self.main_layout.setContentsMargins(20, 20, 20, 20)
        
        # Progress label (only visible in training mode)
        self.progress_label = QLabel("")
        self.progress_label.setStyleSheet("font-size: 16px; font-weight: bold;")
        self.progress_label.setVisible(self.train_mode)
        self.main_layout.addWidget(self.progress_label)
        
        # Image display
        self.image_label = QLabel()
        self.image_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.image_label.setMinimumSize(512, 512)
        self.image_label.setStyleSheet("""
            QLabel {
                background-color: #1e1e1e;
                border: 2px solid #4a90e2;
                border-radius: 8px;
            }
        """)
        self.main_layout.addWidget(self.image_label)
        
        # Create a container for camera preview with center alignment
        camera_container = QWidget()
        camera_layout = QHBoxLayout(camera_container)
        camera_layout.setAlignment(Qt.AlignmentFlag.AlignCenter)
        
        # Camera preview
        self.camera_label = QLabel()
        self.camera_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.camera_label.setMinimumSize(320, 240)
        self.camera_label.setMaximumSize(320, 240)
        self.camera_label.setStyleSheet("""
            QLabel {
                background-color: #1e1e1e;
                border: 2px solid #4a90e2;
                border-radius: 8px;
            }
        """)
        camera_layout.addWidget(self.camera_label)
        self.main_layout.addWidget(camera_container)
        
        # Hide camera preview if tracking is hidden
        if self.hide_tracking:
            self.camera_label.hide()
            camera_container.hide()
        
        # Timer label (only visible in training mode)
        self.timer_label = QLabel("Time: 0 s")
        self.timer_label.setStyleSheet("font-size: 18px; font-weight: bold;")
        self.timer_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.timer_label.setVisible(self.train_mode)
        self.main_layout.addWidget(self.timer_label)
        
        # Instructions label
        self.instructions_label = QLabel(
            "Move your head to view different perspectives"
        )
        self.instructions_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.instructions_label.setStyleSheet("color: #a0a0a0;")
        self.main_layout.addWidget(self.instructions_label)
        
        # Loading progress bar (initially hidden)
        self.loading_progress = QProgressBar()
        self.loading_progress.setMinimum(0)
        self.loading_progress.setMaximum(100)
        self.loading_progress.setValue(0)
        self.loading_progress.hide()
        self.main_layout.addWidget(self.loading_progress)
        
        # Rating frame (initially hidden)
        self.rating_frame = QFrame()
        rating_layout = QVBoxLayout(self.rating_frame)
        
        # Rating label
        self.rating_label = QLabel("Please rate the quality of the visualization:")
        self.rating_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.rating_label.setStyleSheet("font-size: 16px; font-weight: bold;")
        rating_layout.addWidget(self.rating_label)
        
        # Rating buttons
        rating_buttons_layout = QVBoxLayout()
        rating_buttons_layout.setSpacing(10)
        
        for i in range(1, 6):
            button_layout = QHBoxLayout()
            
            # Create button with rating number
            btn = ModernButton(str(i))
            btn.setFixedSize(50, 50)
            btn.clicked.connect(lambda checked, rating=i: self.submit_rating(rating))
            button_layout.addWidget(btn)
            
            # Add label for the rating
            label = QLabel(f" - {self.rating_labels[i]}")
            label.setStyleSheet("font-size: 14px; color: white;")
            button_layout.addWidget(label)
            
            # Add spacer to push button and label to the left
            button_layout.addStretch()
            
            # Add to rating buttons layout
            rating_buttons_layout.addLayout(button_layout)
        
        rating_layout.addLayout(rating_buttons_layout)
        self.main_layout.addWidget(self.rating_frame)
        self.rating_frame.hide()
        
        # Results frame (initially hidden)
        self.results_frame = QFrame()
        results_layout = QVBoxLayout(self.results_frame)
        
        # Results header
        results_header = QLabel("Experiment Complete - Results")
        results_header.setStyleSheet("font-size: 20px; font-weight: bold;")
        results_header.setAlignment(Qt.AlignmentFlag.AlignCenter)
        results_layout.addWidget(results_header)
        
        # Results table
        self.results_table = QTableWidget()
        self.results_table.setColumnCount(2)
        self.results_table.setHorizontalHeaderLabels(["Sample ID", "Rating (1-Bad to 5-Excellent)"])
        self.results_table.horizontalHeader().setStretchLastSection(True)
        results_layout.addWidget(self.results_table)
        
        # Close button
        close_btn = ModernButton("Close")
        close_btn.clicked.connect(self.close)
        results_layout.addWidget(close_btn)
        
        self.main_layout.addWidget(self.results_frame)
        self.results_frame.hide()
        
        # Set window size
        self.resize(800, 900)
        
        # Start camera update timer
        self.camera_timer = QTimer()
        self.camera_timer.timeout.connect(self.update_camera_frame)
        self.camera_timer.start(int(1000/self.camera_fps))
    
    def update_camera_frame(self):
        """Update the camera preview and process face tracking"""
        if not self.cap or not self.timer_running:
            return
            
        ret, frame = self.cap.read()
        if not ret:
            return
            
        # Convert the frame to RGB for face mesh
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        results = self.face_mesh.process(rgb_frame)
        
        if results.multi_face_landmarks:
            for face_landmarks in results.multi_face_landmarks:
                # Get the nose tip coordinates
                nose_tip = face_landmarks.landmark[1]
                x, y, z = nose_tip.x, nose_tip.y, nose_tip.z
                
                # Draw face mesh landmarks only if tracking is not hidden
                if not self.hide_tracking:
                    h, w, _ = frame.shape
                    for landmark in face_landmarks.landmark:
                        pos = (int(landmark.x * w), int(landmark.y * h))
                        cv2.circle(frame, pos, 1, (0, 255, 0), -1)
                
                # Set origin point if not set
                if not self.origin_known:
                    self.origin_x, self.origin_y, self.origin_z = x, y, z
                    self.origin_known = True
                else:
                    # Calculate relative movement
                    X, Y, Z = (self.origin_x - x), (self.origin_y - y), (self.origin_z - z)
                    # Scale the movements for better sensitivity
                    X *= 0.25
                    Y *= 0.25
                    Z *= 0.25
                    # Generate new view
                    if self.current_model and hasattr(self.current_model, 'generate_view'):
                        try:
                            new_img = self.current_model.generate_view(X, -Y, Z, scale=1)
                            self.display_image(new_img)
                        except Exception as e:
                            print(f"Error generating view: {str(e)}")
        
        # Convert frame for display
        h, w, ch = frame.shape
        bytes_per_line = ch * w
        qt_image = QImage(frame.data, w, h, bytes_per_line, QImage.Format.Format_BGR888)
        self.camera_label.setPixmap(QPixmap.fromImage(qt_image).scaled(
            320, 240, Qt.AspectRatioMode.KeepAspectRatio
        ))
    
    def display_image(self, img):
        """Display an image in the GUI"""
        if isinstance(img, Image.Image):
            # Convert PIL image to numpy array
            img_data = np.array(img)
            if img.mode != "RGB":
                img = img.convert("RGB")
                img_data = np.array(img)
            
            # Create QImage from numpy array
            height, width, channel = img_data.shape
            bytes_per_line = 3 * width
            q_img = QImage(img_data.data, width, height, bytes_per_line, QImage.Format.Format_RGB888)
            
            # Convert to QPixmap and display
            pixmap = QPixmap.fromImage(q_img)
            self.image_label.setPixmap(pixmap)
    
    def start_timer(self, duration):
        """Start the timer for the current test sequence"""
        self.timer_running = True
        self.start_time = time.time()
        self.presentation_time = duration
        self.origin_known = False  # Reset origin for new sequence
        
        # Create and start the timer
        self.timer = QTimer()
        self.timer.timeout.connect(self.update_timer)
        self.timer.start(100)  # Update every 100ms
    
    def update_timer(self):
        """Update the timer display"""
        if not self.timer_running:
            self.timer.stop()
            return
            
        elapsed = time.time() - self.start_time
        remaining = max(0, self.presentation_time - elapsed)
        
        # Update timer label
        self.timer_label.setText(f"Time: {int(remaining)} s")
        
        # Check if time is up
        if remaining <= 0:
            self.timer_running = False
            self.timer.stop()
            self.show_rating_screen()
    
    def closeEvent(self, event):
        """Handle window close event"""
        if self.cap is not None:
            self.cap.release()
        if self.face_mesh is not None:
            self.face_mesh.close()
            
        if self.current_sequence_idx < len(self.test_sequences):
            reply = QMessageBox.question(
                self, 'Quit',
                'Are you sure you want to quit? All progress will be lost.',
                QMessageBox.StandardButton.Yes | QMessageBox.StandardButton.No,
                QMessageBox.StandardButton.No
            )
            
            if reply == QMessageBox.StandardButton.Yes:
                self.cleanup_current_model()
                event.accept()
            else:
                event.ignore()
        else:
            self.cleanup_current_model()
            event.accept()

    def show_loading_screen(self):
        """Show a dedicated loading screen"""
        # Hide all main UI elements
        self.progress_label.hide()
        self.image_label.hide()
        self.timer_label.hide()
        self.instructions_label.hide()
        self.loading_progress.hide()
        self.rating_frame.hide()
        self.results_frame.hide()
        if hasattr(self, 'test_id_widget'):
            self.test_id_widget.hide()
        
        # Create loading widget
        self.loading_widget = QWidget()
        loading_layout = QVBoxLayout(self.loading_widget)
        loading_layout.setSpacing(20)
        loading_layout.setContentsMargins(20, 20, 20, 20)
        
        # Add loading text
        loading_text = QLabel("Loading Test Sequences...")
        loading_text.setStyleSheet("font-size: 20px; font-weight: bold; color: white;")
        loading_text.setAlignment(Qt.AlignmentFlag.AlignCenter)
        loading_layout.addWidget(loading_text)
        
        # Add loading progress bar
        self.init_loading_progress = QProgressBar()
        self.init_loading_progress.setMinimum(0)
        self.init_loading_progress.setMaximum(100)
        self.init_loading_progress.setValue(0)
        self.init_loading_progress.setStyleSheet("""
            QProgressBar {
                border: 1px solid #4a90e2;
                border-radius: 4px;
                text-align: center;
                background-color: #3b3b3b;
                color: white;
                min-height: 30px;
                font-size: 16px;
            }
            QProgressBar::chunk {
                background-color: #4a90e2;
                border-radius: 3px;
            }
        """)
        loading_layout.addWidget(self.init_loading_progress)
        
        # Center the widgets vertically
        loading_layout.addStretch()
        loading_layout.insertStretch(0)
        
        # Add to main layout instead of replacing central widget
        self.main_layout.addWidget(self.loading_widget)

    def submit_rating(self, rating):
        """Handle the rating submission"""
        # Store the rating
        current_sequence = self.test_sequences[self.current_sequence_idx]
        self.results[current_sequence['sample_id']] = rating
        
        # Save to CSV
        import datetime
        import csv
        import os
        
        csv_file = "./Test_Results/ViewSynthesis_Results.csv"
        os.makedirs(os.path.dirname(csv_file), exist_ok=True)
        
        # Get current date and time
        current_datetime = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
        # Prepare the row data
        row_data = {
            'testID': self.test_id,
            'sample_id': current_sequence['sample_id'],
            'rating': rating,
            'rating_label': self.rating_labels[rating],
            'date_time': current_datetime
        }
        
        # Check if file exists to determine if we need to write headers
        file_exists = os.path.isfile(csv_file)
        
        # Write to CSV
        with open(csv_file, 'a', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=['testID', 'sample_id', 'rating', 'rating_label', 'date_time'])
            if not file_exists:
                writer.writeheader()
            writer.writerow(row_data)
        
        # Hide the rating frame and show loading progress
        self.rating_frame.hide()
        self.loading_progress.setValue(0)
        self.loading_progress.show()
        
        # Clean up the current model before moving to next sequence
        self.cleanup_current_model()
        
        # Create a timer to simulate loading progress
        self.loading_timer = QTimer()
        self.loading_timer.timeout.connect(self.update_loading_progress)
        self.loading_timer.start(50)  # Update every 50ms
    
    def show_final_results(self):
        """Show the final results after all sequences have been rated"""
        # Hide all other UI elements
        self.image_label.hide()
        self.timer_label.hide()
        self.instructions_label.hide()
        self.rating_frame.hide()
        self.progress_label.hide()
        
        # Show the results frame
        self.results_frame.show()
        
        # Clear and populate the results table
        self.results_table.setRowCount(len(self.results))
        for row, (sample_id, rating) in enumerate(self.results.items()):
            self.results_table.setItem(row, 0, QTableWidgetItem(sample_id))
            # Show both numeric value and label
            self.results_table.setItem(row, 1, QTableWidgetItem(f"{rating} - {self.rating_labels[rating]}"))
        
        # Print results to terminal
        print("\n===== EXPERIMENT RESULTS =====")
        print("Sample ID\tRating")
        print("----------------------------")
        for sample_id, rating in self.results.items():
            print(f"{sample_id}\t{rating} - {self.rating_labels[rating]}")

    # Inherit other methods from ModelVisualizerQT
    from VISTA_Q_ToolKit_MouseControl import ModelVisualizerQT
    show_test_id_screen = ModelVisualizerQT.show_test_id_screen
    start_test = ModelVisualizerQT.start_test
    update_init_loading_progress = ModelVisualizerQT.update_init_loading_progress
    start_next_sequence = ModelVisualizerQT.start_next_sequence
    load_vista_model = ModelVisualizerQT.load_vista_model
    show_rating_screen = ModelVisualizerQT.show_rating_screen
    cleanup_current_model = ModelVisualizerQT.cleanup_current_model
    update_loading_progress = ModelVisualizerQT.update_loading_progress
    create_fallback_image = ModelVisualizerQT.create_fallback_image
    _load_test_sequences = ModelVisualizerQT._load_test_sequences

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='VISTA-Q: View Synthesis (Camera Control)')
    parser.add_argument('--train_user', action='store_true', help='Enable training mode with progress and timer')
    parser.add_argument('--csv_file', type=str, default='./Test_Configs/ViewSynthesis_Test_Sequence.csv', help='Path to test sequence CSV file')
    parser.add_argument('--camera_fps', type=int, default=30, help='Camera capture frame rate')
    parser.add_argument('--hide_tracking', action='store_true', help='Hide face tracking visualization')
    
    args = parser.parse_args()
    
    app = QApplication(sys.argv)
    window = ModelVisualizerQTCamera(
        csv_file=args.csv_file,
        train_mode=args.train_user,
        camera_fps=args.camera_fps,
        hide_tracking=args.hide_tracking
    )
    window.show()
    sys.exit(app.exec()) 