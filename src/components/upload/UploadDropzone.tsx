import { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, FileImage, File, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface UploadDropzoneProps {
  onUpload: (files: File[]) => void;
  accept?: string[];
  maxFiles?: number;
}

export function UploadDropzone({ 
  onUpload, 
  accept = ["image/*", "application/pdf"],
  maxFiles = 5 
}: UploadDropzoneProps) {
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const newFiles = [...uploadedFiles, ...acceptedFiles].slice(0, maxFiles);
    setUploadedFiles(newFiles);
    onUpload(newFiles);
  }, [uploadedFiles, maxFiles, onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept.reduce((acc, type) => ({ ...acc, [type]: [] }), {}),
    maxFiles: maxFiles - uploadedFiles.length,
    disabled: uploadedFiles.length >= maxFiles
  });

  const removeFile = (index: number) => {
    const newFiles = uploadedFiles.filter((_, i) => i !== index);
    setUploadedFiles(newFiles);
    onUpload(newFiles);
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith("image/")) {
      return <FileImage className="w-8 h-8 text-accent" />;
    }
    return <File className="w-8 h-8 text-accent" />;
  };

  return (
    <div className="space-y-4">
      <Card 
        {...getRootProps()} 
        className={`
          cursor-pointer border-2 border-dashed transition-all duration-200
          ${isDragActive 
            ? "border-accent bg-accent/5 shadow-glow" 
            : "border-border hover:border-accent/50 hover:bg-accent/5"
          }
          ${uploadedFiles.length >= maxFiles ? "opacity-50 cursor-not-allowed" : ""}
        `}
      >
        <CardContent className="p-8 text-center">
          <input {...getInputProps()} />
          
          <div className="mx-auto w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-4">
            <Upload className="w-8 h-8 text-accent" />
          </div>
          
          <h3 className="text-lg font-semibold text-text mb-2">
            {isDragActive ? "Drop your files here" : "Upload your notes"}
          </h3>
          
          <p className="text-muted mb-4">
            Drag & drop images or PDFs, or click to browse
          </p>
          
          <Button variant="outline" disabled={uploadedFiles.length >= maxFiles}>
            Choose Files
          </Button>
          
          <p className="text-xs text-muted mt-4">
            Supports PNG, JPG, PDF • Max {maxFiles} files • Up to 10MB each
          </p>
        </CardContent>
      </Card>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-text">Uploaded Files</h4>
          {uploadedFiles.map((file, index) => (
            <Card key={index} className="surface-elevated">
              <CardContent className="p-3 flex items-center gap-3">
                {getFileIcon(file)}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">
                    {file.name}
                  </p>
                  <p className="text-xs text-muted">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeFile(index)}
                  className="w-8 h-8"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}