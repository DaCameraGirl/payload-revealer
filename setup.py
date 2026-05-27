from setuptools import setup, find_packages

setup(
    name="payload-revealer",
    version="1.0.0",
    description="Hidden Unicode payload scanner & steganography detector",
    author="Payload Revealer Project",
    license="MIT",
    packages=find_packages(),
    python_requires=">=3.10",
    entry_points={
        "console_scripts": [
            "payload-revealer=payload_revealer.cli.reveal:main",
        ],
    },
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Developers",
        "Intended Audience :: Information Technology",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Security",
        "Topic :: Text Processing",
    ],
)
