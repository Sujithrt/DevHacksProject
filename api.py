import boto3
from dotenv import load_dotenv
import os
from fastapi import FastAPI, Header
from fastapi.responses import JSONResponse
import uuid
import json
from google import genai
from pydantic import BaseModel
from typing import Optional, List, Annotated
from fastapi.middleware.cors import CORSMiddleware


class Task(BaseModel):
    action: str
    id: str
    value: Optional[str]

class Data(BaseModel):
    id: str
    tag: str
    value: str

load_dotenv()

s3_client = boto3.client('s3', 
    aws_access_key_id=os.getenv("ACCESS_KEY"),
    aws_secret_access_key=os.getenv("ACCESS_SECRET"),
    region_name="us-west-2"
)
transcribe_client = boto3.client('transcribe',
    aws_access_key_id=os.getenv("ACCESS_KEY"),
    aws_secret_access_key=os.getenv("ACCESS_SECRET"),
    region_name="us-west-2"
)

gemini_client = genai.Client(api_key=os.getenv("GEMINI_KEY"))

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Adjust this to restrict origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/flow")
def flow(id: Annotated[str, Header()], data: List[Data]):  
    print(id)
    print(data)
    data_str = "["
    for d in data:
        data_str += f"{{'id': '{d.id}', 'tag': '{d.tag}', 'value': '{d.value}'}},"
    data_str = data_str[:-1] + "]"
    with open(f"/Users/supradparashar/Downloads/tmp/recorded_audio_{id}.wav", "rb") as audio_file:
        response = s3_client.put_object(
            Bucket="devhacks",
            Key="audio.wav",
            Body=audio_file.read(),
        )
        if response.get("ResponseMetadata", {}).get("HTTPStatusCode") == 200:
            print("Upload successful!")
        else:
            print("Upload failed!", response)
    while True:
        try:
            s3_client.head_object(Bucket="devhacks", Key="audio.wav")
            print("Upload verified! File exists in S3.")
            break
        except s3_client.exceptions.ClientError as e:
            if e.response['Error']['Code'] == "404":
                print("File not found in S3. Upload may have failed.")
            else:
                print(f"Error: {e}")
    print("File exists in S3.")
    uid = str(uuid.uuid4())
    transcription_job_name = "DevHacksTranscriptionJob_" + uid
    job = transcribe_client.start_transcription_job(
        TranscriptionJobName=transcription_job_name,
        Media={
            "MediaFileUri": "s3://devhacks/audio.wav",
        },
        LanguageCode="en-US",
        OutputBucketName='devhacks'
    )
    while True:
        response = transcribe_client.get_transcription_job(
            TranscriptionJobName=transcription_job_name
        )
        if response["TranscriptionJob"]["TranscriptionJobStatus"] == "COMPLETED":
            break
    response = s3_client.get_object(
        Bucket='devhacks',
        Key=f'{transcription_job_name}.json',
    )
    transcription = json.loads(response["Body"].read())["results"]["transcripts"][0]["transcript"]
    # transcription = "Navigate to the projects page."
    response = gemini_client.models.generate_content(
        model='gemini-2.0-flash',
        contents=f'Based on the following request and the available data, \
            return the element with the correct action, id and the value. The action is between [type, click].\
                The value is the data to be populated. It is available only to type actions only.\n\n\
                    Request: {transcription}\n\n\
                    Data: {data_str}\n\n',
        config={
            'response_mime_type': 'application/json',
            'response_schema': Task,
        },
    )
    gemini_data = json.loads(response.text)
    return {"status": "success", "task": {
        "action": gemini_data["action"],
        "id": gemini_data["id"],
        "value": gemini_data["value"],
        "transcription": transcription,
        "data": data
    }}
