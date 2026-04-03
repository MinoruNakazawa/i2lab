#!/usr/bin/env python3
"""
Capture camera feed, apply blur, show in window.
Usage:
    python blur_camera.py --radius N

Press 'q' to quit.
"""

import argparse
import cv2


def parse_args():
    parser = argparse.ArgumentParser(description="Blur camera feed")
    parser.add_argument("--radius", type=int, default=5,
                        help="Blur radius (kernel size). Must be odd.")
    return parser.parse_args()


def main():
    args = parse_args()
    radius = args.radius
    if radius % 2 == 0:
        radius += 1
    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: could not open camera")
        return

    print("Press '+' or '-' to increase/decrease blur radius, 'q' to quit.")
    while True:
        ret, frame = cap.read()
        if not ret:
            print("Failed to read frame")
            break
        # ensure radius is odd and at least 1
        r = max(1, radius | 1)
        blurred = cv2.GaussianBlur(frame, (r, r), 0)
        cv2.imshow('Blurred Camera', blurred)
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('+') or key == ord('='):
            radius += 2
        elif key == ord('-') and radius > 1:
            radius = max(1, radius - 2)

    cap.release()
    cv2.destroyAllWindows()


if __name__ == '__main__':
    main()
