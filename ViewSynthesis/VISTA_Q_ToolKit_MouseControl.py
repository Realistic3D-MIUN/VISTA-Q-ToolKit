import os
import sys
import time
import csv
import random
import importlib.util
from PyQt6.QtWidgets import (QApplication, QMainWindow, QWidget, QVBoxLayout, 
                            QHBoxLayout, QLabel, QPushButton, QFrame, QTableWidget, 
                            QTableWidgetItem, QMessageBox, QProgressBar)
from PyQt6.QtCore import Qt, QTimer
from PyQt6.QtGui import QImage, QPixmap
from PIL import Image
import pandas as pd
import numpy as np
import argparse

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

class ModelVisualizerQT(QMainWindow):
    def __init__(self, csv_file="./Test_Configs/ViewSynthesis_Test_Sequence.csv", train_mode=False):
        super().__init__()
        self.csv_file = csv_file
        self.train_mode = train_mode
        self.test_id = None
        self.test_sequences = None
        self.current_sequence_idx = 0
        self.results = {}
        
        # Variables
        self.current_model = None
        self.timer_running = False
        self.start_time = 0
        self.presentation_time = 0
        self.mouse_sensitivity = 5000
        self.current_z_offset = 0  # Initialize z-offset
        
        # Rating labels
        self.rating_labels = {
            1: "Bad",
            2: "Poor",
            3: "Fair",
            4: "Good",
            5: "Excellent"
        }
        
        # Set window size and position
        self.resize(800, 800)
        self.setMinimumSize(800, 800)
        
        # Create main container widget
        self.main_container = QWidget()
        self.setCentralWidget(self.main_container)
        self.main_layout = QVBoxLayout(self.main_container)
        self.main_layout.setSpacing(20)
        self.main_layout.setContentsMargins(20, 20, 20, 20)
        
        # Set up the UI
        self.setup_ui()
        
        # Show test ID input first
        self.show_test_id_screen()
        
    def _load_test_sequences(self):
        """Load and randomize test sequences from CSV file"""
        try:
            # Read the CSV file into a DataFrame
            df = pd.read_csv(self.csv_file)
            
            # Convert DataFrame to list of dictionaries
            sequences = df.to_dict('records')
            
            # Randomize the order
            random.shuffle(sequences)
            
            return sequences
        except Exception as e:
            print(f"Error loading test sequences: {str(e)}")
            return []
    
    def setup_ui(self):
        """Set up the modern user interface"""
        self.setWindowTitle("VISTA-Q: View Synthesis")
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
        
        # Timer label (only visible in training mode)
        self.timer_label = QLabel("Time: 0 s")
        self.timer_label.setStyleSheet("font-size: 18px; font-weight: bold;")
        self.timer_label.setAlignment(Qt.AlignmentFlag.AlignCenter)
        self.timer_label.setVisible(self.train_mode)
        self.main_layout.addWidget(self.timer_label)
        
        # Instructions label
        self.instructions_label = QLabel(
            "Move your mouse while holding the left button to view different perspectives, use scroll wheel to zoom in and out"
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
        self.results_table.setHorizontalHeaderLabels(["Sample ID", "Rating"])
        self.results_table.horizontalHeader().setStretchLastSection(True)
        results_layout.addWidget(self.results_table)
        
        # Close button
        close_btn = ModernButton("Close")
        close_btn.clicked.connect(self.close)
        results_layout.addWidget(close_btn)
        
        self.main_layout.addWidget(self.results_frame)
        self.results_frame.hide()
        
        # Set up mouse tracking
        self.image_label.setMouseTracking(True)
        self.image_label.mousePressEvent = self.on_mouse_press
        self.image_label.mouseMoveEvent = self.on_mouse_move
        self.image_label.mouseReleaseEvent = self.on_mouse_release
    
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
        
        # Add to main layout
        self.main_layout.addWidget(self.loading_widget)
    
    def show_test_id_screen(self):
        """Show the test ID input screen"""
        # Hide all main UI elements
        self.progress_label.hide()
        self.image_label.hide()
        self.timer_label.hide()
        self.instructions_label.hide()
        self.loading_progress.hide()
        self.rating_frame.hide()
        self.results_frame.hide()
        
        # Create and set up the test ID input widget
        self.test_id_widget = QWidget()
        test_id_layout = QVBoxLayout(self.test_id_widget)
        test_id_layout.setSpacing(20)
        test_id_layout.setContentsMargins(20, 20, 20, 20)
        
        # Add title
        title = QLabel("VISTA-Q: View Synthesis")
        title.setStyleSheet("font-size: 24px; font-weight: bold; color: white;")
        title.setAlignment(Qt.AlignmentFlag.AlignCenter)
        test_id_layout.addWidget(title)
        
        # Add test ID input
        from PyQt6.QtWidgets import QLineEdit
        self.test_id_input = QLineEdit()
        self.test_id_input.setPlaceholderText("Enter Your Test ID")
        self.test_id_input.setStyleSheet("""
            QLineEdit {
                background-color: #3b3b3b;
                color: white;
                border: 1px solid #4a90e2;
                border-radius: 4px;
                padding: 8px;
                font-size: 14px;
            }
        """)
        test_id_layout.addWidget(self.test_id_input)
        
        # Add submit button
        submit_btn = ModernButton("Start Test")
        submit_btn.clicked.connect(self.start_test)
        test_id_layout.addWidget(submit_btn)
        
        # Center the widgets vertically
        test_id_layout.addStretch()
        test_id_layout.insertStretch(0)
        
        # Add to main layout
        self.main_layout.addWidget(self.test_id_widget)
        
    def start_test(self):
        """Start the test after test ID is submitted"""
        self.test_id = self.test_id_input.text().strip()
        if not self.test_id:
            QMessageBox.warning(self, "Error", "Please enter a Test ID")
            return
        
        # Hide test ID screen
        self.test_id_widget.hide()
        
        # Show loading screen
        self.show_loading_screen()
        
        # Create a timer to simulate loading progress
        self.init_loading_timer = QTimer()
        self.init_loading_timer.timeout.connect(self.update_init_loading_progress)
        self.init_loading_timer.start(30)  # Update every 30ms
    
    def update_init_loading_progress(self):
        """Update the initial loading progress bar"""
        current_value = self.init_loading_progress.value()
        if current_value >= 100:
            self.init_loading_timer.stop()
            # Load test sequences and start
            self.test_sequences = self._load_test_sequences()
            
            # Hide loading screen
            if hasattr(self, 'loading_widget'):
                self.loading_widget.hide()
            
            # Show main UI elements
            self.progress_label.show()
            self.image_label.show()
            self.timer_label.show()
            self.instructions_label.show()
            
            # Start the first sequence
            self.start_next_sequence()
        else:
            self.init_loading_progress.setValue(current_value + 10)  # Increment by 10%
    
    def start_next_sequence(self):
        """Start the next test sequence if available"""
        if self.current_sequence_idx >= len(self.test_sequences):
            self.show_final_results()
            return
        
        # Get the current sequence
        sequence = self.test_sequences[self.current_sequence_idx]
        
        # Update progress label only in training mode
        if self.train_mode:
            self.progress_label.setText(
                f"Sequence {self.current_sequence_idx + 1}/{len(self.test_sequences)}: {sequence['sample_id']}"
            )
            self.progress_label.show()
        
        # Show main viewing UI
        self.image_label.show()
        self.timer_label.show()
        self.instructions_label.show()
        self.rating_frame.hide()
        self.results_frame.hide()
        
        # Load the model from the specified folder
        self.load_vista_model(sequence)
    
    def load_vista_model(self, sequence):
        """Load the VISTA_Q model from the specified folder"""
        try:
            # Clean up any previous model
            self.cleanup_current_model()
            
            # Reset z-offset to 0 for new model
            self.current_z_offset = 0
            
            # Show loading progress
            self.loading_progress.setValue(0)
            self.loading_progress.show()
            
            # Get the module path
            model_folder = sequence['model_folder']
            module_path = os.path.join(model_folder, "VISTA_Q.py")
            module_name = f"VISTA_Q_{model_folder.replace('./', '').replace('/', '_')}"
            
            print(f"Loading model from: {module_path}")
            self.loading_progress.setValue(10)  # Started loading model
            
            # Add the model folder to sys.path temporarily
            original_sys_path = sys.path.copy()
            model_dir = os.path.abspath(model_folder)
            parent_dir = os.path.dirname(model_dir)
            
            # Add both the model directory and parent directory to sys.path
            sys.path.insert(0, model_dir)
            sys.path.insert(0, parent_dir)
            
            try:
                # Force reload the VISTA_Q module
                if module_name in sys.modules:
                    del sys.modules[module_name]
                
                # Import the module using a unique name to avoid namespace conflicts
                spec = importlib.util.spec_from_file_location(module_name, module_path)
                module = importlib.util.module_from_spec(spec)
                
                # Execute the module in its own namespace
                spec.loader.exec_module(module)
                self.loading_progress.setValue(30)  # Module loaded
                
                # Create an instance of VISTA_Q
                self.current_model = module.VISTA_Q()
                self.loading_progress.setValue(40)  # Model instance created
                
                # Initialize the model
                if hasattr(self.current_model, 'load_model'):
                    self.current_model.load_model()
                    print(f"Model loaded from {sequence['model_folder']}")
                    self.loading_progress.setValue(60)  # Model weights loaded
                    
                    # Load the image
                    if hasattr(self.current_model, 'load_image'):
                        print(f"Loading image from: {sequence['image_path']}")
                        self.current_model.load_image(sequence['image_path'])
                        print(f"Image loaded from {sequence['image_path']}")
                        self.loading_progress.setValue(80)  # Image loaded
                        
                        # Generate the initial view
                        if hasattr(self.current_model, 'generate_view'):
                            try:
                                print("Generating initial view...")
                                initial_img = self.current_model.generate_view(0, 0, 0, scale=1)
                                print(f"Initial view generated, size: {initial_img.size}")
                                self.display_image(initial_img)
                                self.loading_progress.setValue(100)  # Initial view generated
                                self.loading_progress.hide()
                                
                                # Start the timer
                                self.start_timer(sequence['presentation_time'])
                                return
                            except Exception as e:
                                print(f"Error generating initial view: {str(e)}")
                                import traceback
                                traceback.print_exc()
            finally:
                # Restore the original sys.path
                sys.path = original_sys_path
            
            # If we get here, something failed
            print(f"Failed to initialize model from {sequence['model_folder']}")
            
            # Display a fallback image
            fallback_img = self.create_fallback_image(sequence)
            self.display_image(fallback_img)
            self.loading_progress.hide()
            self.start_timer(sequence['presentation_time'])
            
        except Exception as e:
            print(f"Error loading VISTA_Q model: {str(e)}")
            import traceback
            traceback.print_exc()
            
            # Display a fallback image
            fallback_img = self.create_fallback_image(sequence)
            self.display_image(fallback_img)
            self.loading_progress.hide()
            self.start_timer(sequence['presentation_time'])
    
    def display_image(self, img):
        """Display an image in the GUI"""
        # Convert PIL image to QImage
        if img.mode != "RGB":
            img = img.convert("RGB")
        
        # Convert PIL image to numpy array
        img_data = np.array(img)
        
        # Create QImage from numpy array
        height, width, channel = img_data.shape
        bytes_per_line = 3 * width
        q_img = QImage(img_data.data, width, height, bytes_per_line, QImage.Format.Format_RGB888)
        
        # Convert to QPixmap and display
        pixmap = QPixmap.fromImage(q_img)
        self.image_label.setPixmap(pixmap)
    
    def on_mouse_press(self, event):
        """Handle mouse press event"""
        if event.button() == Qt.MouseButton.LeftButton:
            self.last_mouse_pos = event.pos()
    
    def on_mouse_move(self, event):
        """Handle mouse move event"""
        if not self.current_model or not self.timer_running:
            return
            
        # Only process if left button is pressed
        if event.buttons() & Qt.MouseButton.LeftButton:
            # Calculate offsets based on center of the widget
            width = self.image_label.width()
            height = self.image_label.height()
            x_offset = (event.pos().x() - width / 2) / self.mouse_sensitivity
            y_offset = (event.pos().y() - height / 2) / self.mouse_sensitivity
            
            # Clamp values to valid range
            x_offset = max(-0.1, min(0.1, x_offset))
            y_offset = max(-0.1, min(0.1, y_offset))
            
            # Generate and display the new view
            try:
                new_img = self.current_model.generate_view(x_offset, y_offset, self.current_z_offset, scale=1)
                self.display_image(new_img)
            except Exception as e:
                print(f"Error generating view: {str(e)}")
    
    def wheelEvent(self, event):
        """Handle mouse wheel event for z-axis movement"""
        if not self.current_model or not self.timer_running:
            return
            
        # Get the wheel delta (positive for scrolling up, negative for down)
        delta = event.angleDelta().y()
        
        # Convert wheel movement to z-offset (adjust sensitivity as needed)
        z_sensitivity = 0.0001  # Adjust this value to control zoom sensitivity
        z_change = delta * z_sensitivity
        
        # Update the current z-offset
        self.current_z_offset = max(-0.1, min(0.1, self.current_z_offset + z_change))
        
        # Generate and display the new view
        try:
            new_img = self.current_model.generate_view(0, 0, self.current_z_offset, scale=1)
            self.display_image(new_img)
        except Exception as e:
            print(f"Error generating view: {str(e)}")
    
    def on_mouse_release(self, event):
        """Handle mouse release event"""
        pass
    
    def start_timer(self, duration):
        """Start the timer for the current test sequence"""
        self.timer_running = True
        self.start_time = time.time()
        self.presentation_time = duration
        
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
    
    def show_rating_screen(self):
        """Show the rating screen after the presentation time is over"""
        # Hide the main content
        self.image_label.hide()
        self.timer_label.hide()
        self.instructions_label.hide()
        
        # Show the rating frame
        self.rating_frame.show()
    
    def cleanup_current_model(self):
        """Clean up the current model and its associated modules"""
        if self.current_model is not None:
            try:
                # Call any cleanup methods the model might have
                if hasattr(self.current_model, 'cleanup'):
                    self.current_model.cleanup()
                
                # Delete the model instance
                del self.current_model
                self.current_model = None
                
                # Clean up modules that might conflict
                module_prefixes = ['model', 'utils', 'parameters', 'helper']
                for mod_name in list(sys.modules.keys()):
                    if any(mod_name.startswith(prefix) for prefix in module_prefixes):
                        del sys.modules[mod_name]
                        
                # Force garbage collection
                import gc
                gc.collect()
                
            except Exception as e:
                print(f"Error during model cleanup: {str(e)}")
    
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
    
    def update_loading_progress(self):
        """Update the loading progress bar"""
        current_value = self.loading_progress.value()
        if current_value >= 100:
            self.loading_timer.stop()
            self.loading_progress.hide()
            # Move to the next sequence
            self.current_sequence_idx += 1
            self.start_next_sequence()
        else:
            self.loading_progress.setValue(current_value + 10)  # Increment by 10%
    
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
    
    def create_fallback_image(self, sequence):
        """Create a fallback image when a model can't be loaded"""
        # Create a simple image with text
        width, height = 512, 512
        img = Image.new('RGB', (width, height), color='darkgray')
        
        # Try to add text if PIL has ImageDraw
        try:
            from PIL import ImageDraw, ImageFont
            draw = ImageDraw.Draw(img)
            
            # Add some explanatory text
            text = f"Sample: {sequence['sample_id']}\nModel failed to load"
            font_size = 24
            try:
                font = ImageFont.truetype("arial.ttf", font_size)
            except:
                font = ImageFont.load_default()
                
            # Center the text
            text_width = font_size * len(text) // 2  # Approximate width
            text_height = font_size * 2  # Two lines
            position = ((width - text_width) // 2, (height - text_height) // 2)
            
            # Draw with black outline for visibility
            draw.text((position[0]-1, position[1]-1), text, font=font, fill="black")
            draw.text((position[0]+1, position[1]-1), text, font=font, fill="black")
            draw.text((position[0]-1, position[1]+1), text, font=font, fill="black")
            draw.text((position[0]+1, position[1]+1), text, font=font, fill="black")
            
            # Draw the main text
            draw.text(position, text, font=font, fill="white")
            
        except Exception as e:
            print(f"Error creating text on fallback image: {str(e)}")
            
        return img
    
    def closeEvent(self, event):
        """Handle window close event"""
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


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='VISTA-Q: View Synthesis')
    parser.add_argument('--train_user', action='store_true', help='Enable training mode with progress and timer')
    parser.add_argument('--csv_file', type=str, default='./Test_Configs/ViewSynthesis_Test_Sequence.csv', help='Path to test sequence CSV file')
    
    args = parser.parse_args()
    
    app = QApplication(sys.argv)
    window = ModelVisualizerQT(csv_file=args.csv_file, train_mode=args.train_user)
    window.show()
    sys.exit(app.exec()) 