from functools import lru_cache

import boto3
from botocore.client import Config
from botocore.exceptions import ClientError

from .config import get_settings


def _client(endpoint: str):
    settings = get_settings()
    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        region_name=settings.storage_region,
        aws_access_key_id=settings.storage_access_key,
        aws_secret_access_key=settings.storage_secret_key,
        config=Config(signature_version="s3v4"),
    )


@lru_cache
def internal_client():
    return _client(get_settings().storage_endpoint)


@lru_cache
def public_client():
    return _client(get_settings().storage_public_endpoint)


def ensure_bucket() -> None:
    settings = get_settings()
    client = internal_client()
    try:
        client.head_bucket(Bucket=settings.storage_bucket)
    except client.exceptions.ClientError:
        client.create_bucket(Bucket=settings.storage_bucket)
    try:
        client.put_bucket_cors(
            Bucket=settings.storage_bucket,
            CORSConfiguration={
                "CORSRules": [
                    {
                        "AllowedHeaders": ["content-type", "x-amz-meta-expected-size"],
                        "AllowedMethods": ["PUT"],
                        "AllowedOrigins": settings.allowed_origins,
                        "ExposeHeaders": ["etag"],
                        "MaxAgeSeconds": 600,
                    }
                ]
            },
        )
    except ClientError as exc:
        if exc.response.get("Error", {}).get("Code") != "NotImplemented":
            raise


def presigned_put(storage_key: str, content_type: str, size: int) -> str:
    settings = get_settings()
    return public_client().generate_presigned_url(
        "put_object",
        Params={
            "Bucket": settings.storage_bucket,
            "Key": storage_key,
            "ContentType": content_type,
            "Metadata": {"expected-size": str(size)},
        },
        ExpiresIn=600,
    )


def object_metadata(storage_key: str) -> dict:
    return internal_client().head_object(Bucket=get_settings().storage_bucket, Key=storage_key)


def download_object(storage_key: str, file_object) -> None:
    internal_client().download_fileobj(get_settings().storage_bucket, storage_key, file_object)


def delete_object(storage_key: str) -> None:
    internal_client().delete_object(Bucket=get_settings().storage_bucket, Key=storage_key)
