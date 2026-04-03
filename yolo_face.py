from ultralytics import YOLO
import cv2

model = YOLO('yolov8n-face.pt', verbose=False)  # 顔検出専用モデル
cap = cv2.VideoCapture(0)
import time  # for fps throttling

while True:
    start = time.time()
    ret, frame = cap.read()
    if not ret:
        break
    results = model(frame, verbose=False)               # 推論 (出力抑制)
    # resultsには検出ボックスなどが含まれるので描画…
    annotated = results[0].plot()
    cv2.imshow('faces', annotated)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break
    # throttle to ~5 fps
    elapsed = time.time() - start
    if elapsed < 0.2:
        time.sleep(0.2 - elapsed)

cap.release()
cv2.destroyAllWindows()